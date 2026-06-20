import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ePub from 'epubjs'
import { useLibrary } from '../contexts/LibraryContext'
import { getBookFile, saveBookFile, getBookMeta } from '../lib/db'
import { fetchBookContent } from '../lib/gutendex'
import {
  ArrowLeft, Sun, Moon, Coffee, Minus, Plus as PlusIcon,
  ChevronLeft, ChevronRight, Check, BookOpen,
} from 'lucide-react'

// Each theme defines both the page color (what the book content sits on)
// and a slightly different surround color, so the page reads as an object
// with presence rather than a flat rectangle filling the whole screen.
const THEMES = {
  light: { bg: '#FAF8F3', text: '#1A1814', surround: '#E9E5DC', icon: Sun, label: 'Light' },
  sepia: { bg: '#F4ECD8', text: '#3B2F20', surround: '#E4D6B4', icon: Coffee, label: 'Sepia' },
  dark: { bg: '#1C1917', text: '#E8E4DC', surround: '#0E0C0B', icon: Moon, label: 'Dark' },
}

export default function Reader() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { saveProgress, getProgress, collection } = useLibrary()

  const viewerRef = useRef(null)
  const bookRef = useRef(null)
  const renditionRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [controlsVisible, setControlsVisible] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState('light')
  const [fontSize, setFontSize] = useState(18)
  const [percentage, setPercentage] = useState(0)
  const [pageTurning, setPageTurning] = useState(false)
  const [bookTitle, setBookTitle] = useState('')

  // Load and render the book
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const meta = collection.find((b) => b.id === id) || (await getBookMeta(id))
        if (meta?.title) setBookTitle(meta.title)

        // Try offline cache first
        let blob = await getBookFile(id)

        if (!blob) {
          if (!meta) throw new Error('Book not found')
          if (!meta.epubUrl) throw new Error('No epub format available for this book')

          const result = await fetchBookContent(meta)
          blob = result.blob
          saveBookFile(id, blob).catch(() => {})
        }

        if (cancelled) return

        const arrayBuffer = await blob.arrayBuffer()
        const book = ePub(arrayBuffer)
        bookRef.current = book

        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto',
        })
        renditionRef.current = rendition

        applyTheme(rendition, theme, fontSize)

        const existingProgress = getProgress(id)
        if (existingProgress?.location) {
          await rendition.display(existingProgress.location)
          setPercentage(existingProgress.percentage || 0)
        } else {
          await rendition.display()
        }

        rendition.on('relocated', (location) => {
          const pct = book.locations?.length()
            ? Math.round(book.locations.percentageFromCfi(location.start.cfi) * 100)
            : 0
          setPercentage(pct)
          saveProgress(id, { location: location.start.cfi, percentage: pct })
        })

        // Clicks inside the rendered page happen inside an iframe, so they
        // never bubble up to the outer page's onClick handler. epub.js
        // forwards them through the rendition itself instead.
        rendition.on('click', (event) => {
          const view = event.view || window
          const width = view.innerWidth || window.innerWidth
          const x = event.clientX
          if (x < width * 0.25) goPrev()
          else if (x > width * 0.75) goNext()
          else setControlsVisible((v) => !v)
        })

        // Generate locations in background for accurate percentage tracking
        book.ready.then(() => book.locations.generate(1000))

        setLoading(false)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError(err.message || 'Could not open this book')
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
      renditionRef.current?.destroy()
      bookRef.current?.destroy()
    }
  }, [id])

  function applyTheme(rendition, themeName, size) {
    const t = THEMES[themeName]
    rendition.themes.default({
      body: {
        background: `${t.bg} !important`,
        color: `${t.text} !important`,
        'font-family': "'Lora', Georgia, serif !important",
      },
      p: { 'line-height': '1.85 !important' },
    })
    rendition.themes.fontSize(`${size}px`)
  }

  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, theme, fontSize)
    }
  }, [theme, fontSize])

  // epub.js doesn't always reflow cleanly when the viewport changes size,
  // such as DevTools opening/closing, the settings panel toggling layout,
  // or a phone rotating. Force a resize whenever that happens.
  useEffect(() => {
    let resizeTimeout
    function handleResize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const rendition = renditionRef.current
        if (!rendition || !viewerRef.current) return
        const { width, height } = viewerRef.current.getBoundingClientRect()
        rendition.resize(width, height)
      }, 200)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Page turns get a brief crossfade instead of an abrupt cut, this is the
  // single biggest thing that makes a paginated web reader feel considered
  // rather than mechanical.
  const turnPage = useCallback((direction) => {
    setPageTurning(true)
    setTimeout(() => {
      if (direction === 'next') renditionRef.current?.next()
      else renditionRef.current?.prev()
      setTimeout(() => setPageTurning(false), 180)
    }, 130)
  }, [])

  const goNext = useCallback(() => turnPage('next'), [turnPage])
  const goPrev = useCallback(() => turnPage('prev'), [turnPage])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'Escape') { setSettingsOpen(false); setControlsVisible(false) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  const t = THEMES[theme]

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 28%, ${t.bg}, ${t.surround} 78%)`,
      }}
    >
      {/* Top bar, frosted glass, shown on tap */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3.5 transition-all duration-300 ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{
          background: `${t.bg}cc`,
          backdropFilter: 'blur(16px) saturate(1.4)',
          color: t.text,
          borderBottom: `1px solid ${t.text}14`,
        }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-current/5 transition-colors">
          <ArrowLeft size={19} strokeWidth={1.75} />
        </button>
        <p className="text-[13px] font-medium truncate max-w-[55%] opacity-80">{bookTitle}</p>
        <button
          onClick={() => setSettingsOpen((s) => !s)}
          className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors font-serif text-[15px] ${
            settingsOpen ? 'bg-current/10' : 'hover:bg-current/5'
          }`}
        >
          Aa
        </button>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setSettingsOpen(false)} />
          <div
            className="absolute top-14 right-4 z-30 w-64 rounded-2xl shadow-2xl p-4 transition-all"
            style={{
              background: `${t.bg}f5`,
              backdropFilter: 'blur(20px) saturate(1.4)',
              color: t.text,
              border: `1px solid ${t.text}14`,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-50 mb-2.5">Theme</p>
            <div className="flex gap-2.5 mb-5">
              {Object.entries(THEMES).map(([key, themeOpt]) => {
                const Icon = themeOpt.icon
                const active = theme === key
                return (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all"
                    style={{
                      background: themeOpt.bg,
                      color: themeOpt.text,
                      boxShadow: active ? `0 0 0 2px #2D6A5E` : `0 0 0 1px ${themeOpt.text}1a`,
                    }}
                  >
                    <Icon size={15} strokeWidth={1.75} />
                    {active && <Check size={11} className="absolute top-1 right-1" />}
                  </button>
                )
              })}
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-50 mb-2.5">Text size</p>
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-current/5 transition-colors"
              >
                <Minus size={15} />
              </button>
              <div className="flex-1 h-1.5 rounded-full bg-current/10 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${((fontSize - 14) / 14) * 100}%`, background: '#2D6A5E' }}
                />
              </div>
              <button
                onClick={() => setFontSize((s) => Math.min(28, s + 2))}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-current/5 transition-colors"
              >
                <PlusIcon size={15} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-[280px] h-[400px] rounded-xl animate-pulse flex items-center justify-center"
            style={{ background: t.surround }}
          >
            <BookOpen size={28} strokeWidth={1.5} style={{ color: t.text, opacity: 0.25 }} />
          </div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ color: t.text }}>
          <p className="text-sm font-body opacity-80">{error}</p>
          <button onClick={() => navigate(-1)} className="text-teal-600 text-sm font-medium">
            Go back
          </button>
        </div>
      )}

      {/* Reading surface, the page itself gets a shadow and rounded corners
          so it reads as an object rather than a flat fullscreen rectangle */}
      <div
        className="flex-1 relative flex items-center justify-center px-0 md:px-10 py-0 md:py-8"
        onClick={() => setControlsVisible((v) => !v)}
      >
        <div
          className="relative w-full h-full md:max-w-[760px] md:rounded-2xl overflow-hidden transition-opacity ease-out"
          style={{
            background: t.bg,
            boxShadow: '0 30px 60px -20px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.04)',
            opacity: pageTurning ? 0 : 1,
            transitionDuration: pageTurning ? '130ms' : '180ms',
          }}
        >
          <div ref={viewerRef} className="absolute inset-0" />
        </div>

        {/* Hover nav arrows, desktop only */}
        <button
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full opacity-0 hover:opacity-70 transition-opacity z-10"
          style={{ color: t.text }}
        >
          <ChevronLeft size={26} strokeWidth={1.5} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full opacity-0 hover:opacity-70 transition-opacity z-10"
          style={{ color: t.text }}
        >
          <ChevronRight size={26} strokeWidth={1.5} />
        </button>
      </div>

      {/* Bottom bar, frosted glass, shown on tap */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 px-5 pt-4 pb-5 transition-all duration-300 ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
        style={{
          background: `${t.bg}cc`,
          backdropFilter: 'blur(16px) saturate(1.4)',
          color: t.text,
          borderTop: `1px solid ${t.text}14`,
        }}
      >
        <div className="h-[3px] bg-current/10 rounded-full overflow-hidden mb-2 max-w-md mx-auto">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percentage}%`, background: '#2D6A5E' }}
          />
        </div>
        <p className="text-center text-[11px] opacity-50 font-medium tracking-wide">
          {percentage}% read
        </p>
      </div>
    </div>
  )
}

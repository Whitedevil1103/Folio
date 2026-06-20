import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ePub from 'epubjs'
import { useLibrary } from '../contexts/LibraryContext'
import { getBookFile, saveBookFile, getBookMeta } from '../lib/db'
import { fetchBookContent } from '../lib/gutendex'
import {
  ArrowLeft, Sun, Moon, Coffee, Minus, Plus as PlusIcon, Check, BookOpen,
} from 'lucide-react'

const THEMES = {
  light: { bg: '#FAF8F3', text: '#1A1814', icon: Sun, label: 'Light' },
  sepia: { bg: '#F4ECD8', text: '#3B2F20', icon: Coffee, label: 'Sepia' },
  dark: { bg: '#1C1917', text: '#E8E4DC', icon: Moon, label: 'Dark' },
}

export default function Reader() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { saveProgress, getProgress, collection } = useLibrary()

  const viewerRef = useRef(null)
  const bookRef = useRef(null)
  const renditionRef = useRef(null)
  const scrollCleanupRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [controlsVisible, setControlsVisible] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState('light')
  const [fontSize, setFontSize] = useState(18)
  const [percentage, setPercentage] = useState(0)
  const [bookTitle, setBookTitle] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        const meta = collection.find((b) => b.id === id) || (await getBookMeta(id))
        if (meta?.title) setBookTitle(meta.title)

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

        // scrolled-doc renders one section at a time as a single tall
        // scrollable document. This is far more reliable than the
        // continuous manager, which has known bugs around measuring
        // content height correctly. We auto-advance to the next chapter
        // when the reader nears the bottom, so it still feels continuous.
        const rendition = book.renderTo(viewerRef.current, {
          flow: 'scrolled-doc',
          width: '100%',
          height: '100%',
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

        // A tap toggles the chrome, same gesture as Apple Books / most
        // manga readers, since scrolling itself handles navigation now.
        rendition.on('click', () => setControlsVisible((v) => !v))

        // Auto-advance to the next chapter when nearing the bottom of
        // the current one, so reading still feels like one continuous
        // scroll rather than a hard chapter-by-chapter break.
        let advancing = false
        const container = viewerRef.current
        function handleScroll() {
          if (advancing || !container) return
          const remaining = container.scrollHeight - container.scrollTop - container.clientHeight
          if (remaining < 60) {
            advancing = true
            rendition.next().finally(() => {
              container.scrollTop = 1
              setTimeout(() => { advancing = false }, 400)
            })
          }
        }
        container?.addEventListener('scroll', handleScroll)
        scrollCleanupRef.current = () => container?.removeEventListener('scroll', handleScroll)

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
      scrollCleanupRef.current?.()
      renditionRef.current?.destroy()
      bookRef.current?.destroy()
    }
  }, [id])

  function applyTheme(rendition, themeName, size) {
    const t = THEMES[themeName]
    rendition.themes.default({
      html: { background: `${t.bg} !important` },
      body: {
        background: `${t.bg} !important`,
        color: `${t.text} !important`,
        'font-family': "'Lora', Georgia, serif !important",
        'max-width': '700px !important',
        margin: '0 auto !important',
        padding: '6vh 24px !important',
      },
      p: { 'line-height': '1.85 !important' },
      'img, svg': {
        'max-width': '100% !important',
        height: 'auto !important',
        display: 'block !important',
        margin: '0 auto !important',
      },
    })
    rendition.themes.fontSize(`${size}px`)
  }

  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, theme, fontSize)
    }
  }, [theme, fontSize])

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

  const scrollBy = useCallback((amount) => {
    viewerRef.current?.scrollBy({ top: amount, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') scrollBy(window.innerHeight * 0.85)
      if (e.key === 'ArrowUp' || e.key === 'PageUp') scrollBy(-window.innerHeight * 0.85)
      if (e.key === 'Escape') { setSettingsOpen(false); setControlsVisible(false) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [scrollBy])

  const t = THEMES[theme]

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: t.bg }}>
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
            className="absolute top-14 right-4 z-30 w-64 rounded-2xl shadow-2xl p-4"
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
                    className="relative flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all"
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
          <div className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse" style={{ background: `${t.text}10` }}>
            <BookOpen size={20} strokeWidth={1.5} style={{ color: t.text, opacity: 0.4 }} />
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

      {/* Reading surface, full bleed, no card, no frame. This div owns
          its own scroll since the fixed-position page shell around it
          can't grow with content. */}
      <div
        ref={viewerRef}
        className="flex-1"
        style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
      />

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

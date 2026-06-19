import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ePub from 'epubjs'
import { useLibrary } from '../contexts/LibraryContext'
import { getBookFile, saveBookFile, getBookMeta } from '../lib/db'
import { fetchBookContent } from '../lib/gutendex'
import { ArrowLeft, Sun, Moon, Coffee, Minus, Plus as PlusIcon, ChevronLeft, ChevronRight } from 'lucide-react'

const THEMES = {
  light: { bg: '#F9F7F2', text: '#1A1814', label: 'Light', icon: Sun },
  sepia: { bg: '#F4ECD8', text: '#3B2F20', label: 'Sepia', icon: Coffee },
  dark: { bg: '#1C1917', text: '#E8E4DC', label: 'Dark', icon: Moon },
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
  const [theme, setTheme] = useState('light')
  const [fontSize, setFontSize] = useState(18)
  const [percentage, setPercentage] = useState(0)

  // Load and render the book
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      try {
        // Try offline cache first
        let blob = await getBookFile(id)
        let format = 'epub'

        if (!blob) {
          const meta = collection.find((b) => b.id === id) || (await getBookMeta(id))
          if (!meta) throw new Error('Book not found')
          if (!meta.epubUrl) throw new Error('No epub format available for this book')

          const result = await fetchBookContent(meta)
          blob = result.blob
          format = result.format
          // Cache it for next time / offline use
          saveBookFile(id, blob).catch(() => {})
        }

        if (cancelled) return

        const arrayBuffer = await blob.arrayBuffer()
        const book = ePub(arrayBuffer)
        bookRef.current = book

        // Render the book options container setup
        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto',
          allowScriptedContent: true, // Fixes iframe sandboxing and allows texts to render
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
        
        // Safely attempt the database update without blocking the UI thread
        try {
          saveProgress(id, { location: location.start.cfi, percentage: pct })
            .catch(err => console.warn("Syncing progress paused:", err.message))
        } catch (e) {
          console.warn("Progress update caught:", e)
        }
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
    })
    rendition.themes.fontSize(`${size}px`)
  }

  useEffect(() => {
    if (renditionRef.current) {
      applyTheme(renditionRef.current, theme, fontSize)
    }
  }, [theme, fontSize])

  const goNext = useCallback(() => renditionRef.current?.next(), [])
  const goPrev = useCallback(() => renditionRef.current?.prev(), [])

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  const currentTheme = THEMES[theme]

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: currentTheme.bg }}
    >
      {/* Top bar, shown on tap */}
      <div
        className={`absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 transition-opacity duration-200 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: currentTheme.bg, color: currentTheme.text }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <ArrowLeft size={20} />
        </button>
        <div className="text-xs opacity-60 font-body">{percentage}% read</div>
        <div className="w-9" />
      </div>

      {/* Reading surface */}
      {loading && (
        <div className="flex-1 flex items-center justify-center" style={{ color: currentTheme.text }}>
          <p className="text-sm font-body opacity-70">Opening book...</p>
        </div>
      )}

      {error && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ color: currentTheme.text }}>
          <p className="text-sm font-body opacity-80">{error}</p>
          <button onClick={() => navigate(-1)} className="text-teal-600 text-sm font-medium">
            Go back
          </button>
        </div>
      )}

      <div
        className="flex-1 relative"
        onClick={(e) => {
          const x = e.clientX
          const width = window.innerWidth
          if (x < width * 0.25) goPrev()
          else if (x > width * 0.75) goNext()
          else setControlsVisible((v) => !v)
        }}
      >
        <div ref={viewerRef} className="absolute inset-0" />

        {/* Edge tap zones, visually invisible nav arrows on hover for desktop */}
        <button
          onClick={(e) => { e.stopPropagation(); goPrev() }}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full opacity-0 hover:opacity-60 transition-opacity"
          style={{ color: currentTheme.text }}
        >
          <ChevronLeft size={28} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); goNext() }}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full opacity-0 hover:opacity-60 transition-opacity"
          style={{ color: currentTheme.text }}
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* Bottom controls, shown on tap */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 px-5 py-4 transition-opacity duration-200 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: currentTheme.bg, color: currentTheme.text }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-current/15 rounded-full overflow-hidden mb-4">
          <div className="h-full bg-teal-500" style={{ width: `${percentage}%` }} />
        </div>

        <div className="flex items-center justify-between">
          {/* Theme switcher */}
          <div className="flex gap-2">
            {Object.entries(THEMES).map(([key, t]) => {
              const Icon = t.icon
              return (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`p-2 rounded-full transition-colors ${
                    theme === key ? 'bg-teal-600 text-white' : 'opacity-60'
                  }`}
                >
                  <Icon size={16} />
                </button>
              )
            })}
          </div>

          {/* Font size */}
          <div className="flex items-center gap-3 opacity-80">
            <button onClick={() => setFontSize((s) => Math.max(14, s - 2))}>
              <Minus size={16} />
            </button>
            <span className="text-xs w-6 text-center">{fontSize}</span>
            <button onClick={() => setFontSize((s) => Math.min(28, s + 2))}>
              <PlusIcon size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

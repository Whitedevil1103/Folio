import { useNavigate } from 'react-router-dom'
import { BookOpen, Search, RefreshCw, CloudOff } from 'lucide-react'

// A handful of warm, book-spine-like color treatments echoing the
// gradient placeholder used elsewhere when a real cover isn't loaded,
// so the hero stays on-brand without depending on any external image.
const SPINES = [
  { bg: '#6B2737', text: '#F4ECD8', title: 'Pride and Prejudice', author: 'Austen', rotate: -7 },
  { bg: '#2D6A5E', text: '#F7F5F0', title: 'Frankenstein', author: 'Shelley', rotate: 4 },
  { bg: '#F4ECD8', text: '#3B2F20', title: 'Alice in Wonderland', author: 'Carroll', rotate: -2 },
  { bg: '#1C1917', text: '#E8E4DC', title: 'Sherlock Holmes', author: 'Doyle', rotate: 8 },
]

const VALUE_PROPS = [
  {
    icon: Search,
    title: 'An endless free library',
    body: 'Search the full catalog of Project Gutenberg and Internet Archive, no subscriptions, no waiting lists, no catch.',
  },
  {
    icon: RefreshCw,
    title: 'Never lose your place',
    body: 'Start a chapter on your laptop, finish it on your phone. Your progress follows you automatically.',
  },
  {
    icon: CloudOff,
    title: 'Yours, even offline',
    body: 'Download any book and keep reading on a flight, a subway, or anywhere your signal doesn\u2019t reach.',
  },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-parchment">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-10 py-6 max-w-6xl mx-auto">
        <span className="font-display text-2xl text-teal-600">Folio</span>
        <button
          onClick={() => navigate('/login')}
          className="text-sm font-medium text-ink-muted hover:text-ink transition-colors"
        >
          Sign in
        </button>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 pt-10 md:pt-16 pb-20 md:pb-28 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 md:gap-8 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-600 mb-4">
              Thousands of classics, free forever
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-[3.4rem] leading-[1.08] text-ink mb-6">
              Your library,<br />wherever you are.
            </h1>
            <p className="text-ink-muted text-base md:text-lg leading-relaxed mb-8 max-w-md">
              Search a free, public-domain library pulled straight from Project Gutenberg
              and Internet Archive. Pick up exactly where you left off on any device,
              and keep reading even with no signal.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="bg-teal-600 text-white text-sm font-medium px-6 py-3.5 rounded-lg hover:bg-teal-500 transition-colors"
              >
                Start reading
              </button>
              <span className="text-xs text-ink-muted">No card. No catch.</span>
            </div>
          </div>

          {/* Signature visual: a small fanned stack of book spines */}
          <div className="relative h-72 md:h-80 flex items-center justify-center">
            {SPINES.map((spine, i) => (
              <div
                key={spine.title}
                className="absolute w-32 sm:w-36 aspect-[2/3] rounded-sm shadow-xl flex flex-col justify-between p-3"
                style={{
                  background: spine.bg,
                  color: spine.text,
                  transform: `rotate(${spine.rotate}deg) translateX(${(i - 1.5) * 38}px)`,
                  zIndex: i,
                }}
              >
                <span className="font-display text-sm leading-tight">{spine.title}</span>
                <span className="text-[11px] opacity-70 font-body">{spine.author}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="px-6 md:px-10 py-16 md:py-20 bg-white/60 border-y border-ink/10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 md:gap-8">
          {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center mb-4">
                <Icon size={18} className="text-teal-600" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-xl text-ink mb-2">{title}</h3>
              <p className="text-ink-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 md:px-10 py-20 md:py-28 max-w-6xl mx-auto text-center">
        <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-6">
          <BookOpen size={22} className="text-teal-600" strokeWidth={1.75} />
        </div>
        <h2 className="font-display text-3xl md:text-4xl text-ink mb-4">Pick up a book.</h2>
        <p className="text-ink-muted mb-8">Free, forever, no catch.</p>
        <button
          onClick={() => navigate('/login')}
          className="bg-teal-600 text-white text-sm font-medium px-7 py-3.5 rounded-lg hover:bg-teal-500 transition-colors"
        >
          Start reading
        </button>
      </section>

      <footer className="px-6 md:px-10 py-8 text-center text-xs text-ink-muted border-t border-ink/10">
        Folio reads from Project Gutenberg and the Internet Archive's public-domain collection.
      </footer>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { searchBooks, getPopularBooks, getBooksByTopic, CURATED_TOPICS } from '../lib/gutendex'
import * as archive from '../lib/archive'
import BookCard from '../components/BookCard'
import { Search, Loader2 } from 'lucide-react'

// Runs both sources in parallel and merges whatever succeeds, so if one
// source has a hiccup, the other still shows results instead of the
// whole page failing.
async function mergedFetch(gutendexFn, archiveFn) {
  const [gResult, aResult] = await Promise.allSettled([gutendexFn(), archiveFn()])
  const results = [
    ...(gResult.status === 'fulfilled' ? gResult.value.results : []),
    ...(aResult.status === 'fulfilled' ? aResult.value.results : []),
  ]
  if (gResult.status === 'rejected' && aResult.status === 'rejected') {
    throw new Error('Both sources failed')
  }
  return results
}

export default function Discover() {
  const [query, setQuery] = useState('')
  const [activeTopic, setActiveTopic] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')

  // Remembers how to fetch the *current* search/topic/popular view at
  // an arbitrary page, so "Load more" can just ask for page + 1
  // without needing to know whether we're searching, browsing a topic,
  // or looking at the popular list.
  const fetcherRef = useRef(null)
  const pageRef = useRef(1)

  const runFetch = useCallback(async (makeFetchers, { append = false } = {}) => {
    const targetPage = append ? pageRef.current + 1 : 1
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      const { gutendexFn, archiveFn } = makeFetchers(targetPage)
      const newResults = await mergedFetch(gutendexFn, archiveFn)
      setResults((prev) => (append ? [...prev, ...newResults] : newResults))
      setHasMore(newResults.length > 0)
      pageRef.current = targetPage
    } catch (err) {
      if (!append) setError('Could not load books right now.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const loadPopular = useCallback(() => {
    const makeFetchers = (page) => ({
      gutendexFn: () => getPopularBooks({ page }),
      archiveFn: () => archive.getPopularBooks({ page }),
    })
    fetcherRef.current = makeFetchers
    runFetch(makeFetchers)
  }, [runFetch])

  useEffect(() => {
    loadPopular()
  }, [loadPopular])

  function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) {
      setActiveTopic(null)
      loadPopular()
      return
    }
    setActiveTopic(null)
    const makeFetchers = (page) => ({
      gutendexFn: () => searchBooks(query, { page }),
      archiveFn: () => archive.searchBooks(query, { page }),
    })
    fetcherRef.current = makeFetchers
    runFetch(makeFetchers)
  }

  function handleTopic(topic) {
    setQuery('')
    setActiveTopic(topic)
    const makeFetchers = (page) => ({
      gutendexFn: () => getBooksByTopic(topic, { page }),
      archiveFn: () => archive.getBooksByTopic(topic, { page }),
    })
    fetcherRef.current = makeFetchers
    runFetch(makeFetchers)
  }

  function handleLoadMore() {
    if (fetcherRef.current) runFetch(fetcherRef.current, { append: true })
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl text-ink mb-6">Discover</h1>

      <form onSubmit={handleSearch} className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, authors, or subjects"
          className="w-full pl-11 pr-4 py-3 rounded-full border border-ink/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
        />
      </form>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-1">
        {CURATED_TOPICS.map((topic) => (
          <button
            key={topic}
            onClick={() => handleTopic(topic)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
              activeTopic === topic
                ? 'bg-teal-600 text-white'
                : 'bg-ink/5 text-ink-muted hover:bg-ink/10'
            }`}
          >
            {topic}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-ink-muted gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading books...</span>
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 text-center py-12">{error}</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-12">No books found. Try a different search.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-5">
            {results.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg border border-ink/15 hover:bg-ink/5 transition-colors disabled:opacity-60"
              >
                {loadingMore && <Loader2 size={15} className="animate-spin" />}
                {loadingMore ? 'Loading more...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

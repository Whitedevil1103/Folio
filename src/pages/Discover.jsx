import { useState, useEffect, useCallback } from 'react'
import { searchBooks, getPopularBooks, getBooksByTopic, CURATED_TOPICS } from '../lib/gutendex'
import BookCard from '../components/BookCard'
import { Search, Loader2 } from 'lucide-react'

export default function Discover() {
  const [query, setQuery] = useState('')
  const [activeTopic, setActiveTopic] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadPopular = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getPopularBooks()
      setResults(data.results)
    } catch (err) {
      setError('Could not load books right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPopular()
  }, [loadPopular])

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) {
      setActiveTopic(null)
      loadPopular()
      return
    }
    setActiveTopic(null)
    setLoading(true)
    setError('')
    try {
      const data = await searchBooks(query)
      setResults(data.results)
    } catch (err) {
      setError('Search failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTopic(topic) {
    setQuery('')
    setActiveTopic(topic)
    setLoading(true)
    setError('')
    try {
      const data = await getBooksByTopic(topic)
      setResults(data.results)
    } catch (err) {
      setError('Could not load this topic right now.')
    } finally {
      setLoading(false)
    }
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
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-5">
          {results.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  )
}

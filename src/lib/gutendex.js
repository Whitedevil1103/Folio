// Client for Gutendex, a free public API over Project Gutenberg's catalog
// of 70,000+ public domain books. No auth, no rate limit headaches.
// Docs: https://gutendex.com

const GUTENDEX_BASE = 'https://gutendex.com/books'

function mapBook(raw) {
  const author = raw.authors?.[0]?.name || 'Unknown author'
  const cover = raw.formats?.['image/jpeg'] || null
  // Prefer plain text or epub formats for in-app reading
  const epubUrl = raw.formats?.['application/epub+zip'] || null
  const textUrl =
    raw.formats?.['text/plain; charset=utf-8'] ||
    raw.formats?.['text/plain'] ||
    null

  return {
    id: `gutenberg-${raw.id}`,
    sourceId: raw.id,
    source: 'gutenberg',
    title: raw.title,
    author,
    authors: raw.authors?.map((a) => a.name) || [],
    cover,
    subjects: raw.subjects || [],
    languages: raw.languages || [],
    downloadCount: raw.download_count || 0,
    epubUrl,
    textUrl,
  }
}

export async function searchBooks(query, { page = 1 } = {}) {
  const url = new URL(GUTENDEX_BASE)
  if (query) url.searchParams.set('search', query)
  url.searchParams.set('page', page)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Search request failed')
  const data = await res.json()

  return {
    count: data.count,
    next: data.next,
    previous: data.previous,
    results: (data.results || []).map(mapBook),
  }
}

export async function getBooksByTopic(topic, { page = 1 } = {}) {
  const url = new URL(GUTENDEX_BASE)
  url.searchParams.set('topic', topic)
  url.searchParams.set('page', page)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Topic request failed')
  const data = await res.json()

  return {
    count: data.count,
    next: data.next,
    results: (data.results || []).map(mapBook),
  }
}

export async function getPopularBooks({ page = 1 } = {}) {
  const url = new URL(GUTENDEX_BASE)
  url.searchParams.set('page', page)
  // Gutendex defaults to sorting by popularity (download count)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Popular books request failed')
  const data = await res.json()

  return {
    count: data.count,
    next: data.next,
    results: (data.results || []).map(mapBook),
  }
}

export async function getBookById(gutenbergId) {
  const res = await fetch(`${GUTENDEX_BASE}/${gutenbergId}`)
  if (!res.ok) throw new Error('Book not found')
  const data = await res.json()
  return mapBook(data)
}

// Fetch the actual readable file content for a book (used for offline caching)
export async function fetchBookContent(book) {
  const url = book.epubUrl || book.textUrl
  if (!url) throw new Error('No readable format available for this book')

  // Convert the full gutenberg URL into your local Vercel proxy route
  // e.g., https://www.gutenberg.org/ebooks/84 -> /api/gutenberg/ebooks/84
  const localProxyUrl = url.replace('https://www.gutenberg.org', '/api/gutenberg')

  const res = await fetch(localProxyUrl)
  if (!res.ok) throw new Error('Failed to download book content')
  
  const blob = await res.blob()
  return { blob, format: book.epubUrl ? 'epub' : 'text' }
}

export const CURATED_TOPICS = [
  'fiction',
  'fantasy',
  'romance',
  'mystery',
  'philosophy',
  'history',
  'science',
  'poetry',
  'adventure',
  'drama',
]

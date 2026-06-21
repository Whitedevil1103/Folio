// Client for Internet Archive's open Advanced Search API, scoped to
// items that are confirmed fully public domain and freely downloadable,
// not their lending library (which uses DRM and isn't meant to be
// extracted into a third-party reader).
//
// Everything routes through /api/archive/* (see vercel.json), the same
// pattern used for Gutenberg, so we never depend on archive.org's CORS
// policy for any given endpoint.

const ARCHIVE_PROXY = '/api/archive'

// Items with access-restricted-item:true are part of the controlled
// lending library and are deliberately excluded here.
const PUBLIC_DOMAIN_FILTER = 'mediatype:texts AND NOT access-restricted-item:true'

function mapItem(doc) {
  const identifier = doc.identifier
  return {
    id: `archive-${identifier}`,
    sourceId: identifier,
    source: 'archive',
    title: doc.title || 'Untitled',
    author: doc.creator || 'Unknown author',
    authors: Array.isArray(doc.creator) ? doc.creator : doc.creator ? [doc.creator] : [],
    cover: `${ARCHIVE_PROXY}/services/img/${identifier}`,
    subjects: Array.isArray(doc.subject) ? doc.subject : doc.subject ? [doc.subject] : [],
    languages: doc.language ? [doc.language] : [],
    downloadCount: doc.downloads || 0,
    epubUrl: null,
    textUrl: null,
    needsEpubResolution: true,
  }
}

// Internet Archive's search index only covers item-level metadata
// (title, creator, collection...), not individual file listings, so
// there's no query-string way to filter by "has an epub file" the way
// format:"EPUB" might suggest. This checks each result's real file
// listing directly, the same lookup the reader uses to download a
// book, and drops anything that doesn't actually have one. Items that
// pass get their epub URL resolved right away, so there's no separate
// lookup needed later when the user opens the book.
async function verifyAndResolve(items) {
  const checked = await Promise.allSettled(
    items.map(async (item) => {
      const url = await resolveArchiveEpubUrl(item.sourceId)
      if (!url) throw new Error('No epub')
      return { ...item, epubUrl: url, needsEpubResolution: false }
    })
  )
  return checked
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
}

async function searchRaw(query, { page = 1, rows = 20, sort = '' } = {}) {
  const url = new URL(`${ARCHIVE_PROXY}/advancedsearch.php`, window.location.origin)
  url.searchParams.set('q', query)
  url.searchParams.set('fl[]', 'identifier')
  url.searchParams.append('fl[]', 'title')
  url.searchParams.append('fl[]', 'creator')
  url.searchParams.append('fl[]', 'subject')
  url.searchParams.append('fl[]', 'language')
  url.searchParams.append('fl[]', 'downloads')
  // Over-fetch since a chunk of these will turn out to have no epub
  // and get filtered out after the real check below.
  url.searchParams.set('rows', rows * 3)
  url.searchParams.set('page', page)
  url.searchParams.set('output', 'json')
  if (sort) url.searchParams.set('sort[]', sort)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Internet Archive search failed')
  const data = await res.json()
  const docs = data?.response?.docs || []
  const candidates = docs.map(mapItem)
  const verified = await verifyAndResolve(candidates)

  return {
    count: data?.response?.numFound || 0,
    results: verified.slice(0, rows),
  }
}

export async function searchBooks(query, opts = {}) {
  const q = query ? `${PUBLIC_DOMAIN_FILTER} AND (${query})` : PUBLIC_DOMAIN_FILTER
  return searchRaw(q, { ...opts, sort: 'downloads desc' })
}

export async function getBooksByTopic(topic, opts = {}) {
  return searchRaw(`${PUBLIC_DOMAIN_FILTER} AND subject:"${topic}"`, { ...opts, sort: 'downloads desc' })
}

export async function getPopularBooks(opts = {}) {
  return searchRaw(PUBLIC_DOMAIN_FILTER, { ...opts, sort: 'downloads desc' })
}

export async function getBookById(identifier) {
  const results = await searchRaw(`identifier:${identifier}`, { rows: 1 })
  if (!results.results.length) throw new Error('Book not found')
  return results.results[0]
}

// Internet Archive's search results don't include the actual epub
// filename, only that the item exists, so this looks up the item's
// file listing once and finds the right one. Called lazily, only when
// the user actually opens the book, not for every search result.
export async function resolveArchiveEpubUrl(identifier) {
  const res = await fetch(`${ARCHIVE_PROXY}/metadata/${identifier}`)
  if (!res.ok) throw new Error('Could not load this book\'s file listing')
  const data = await res.json()
  const files = data?.files || []
  const epubFile = files.find((f) => f.name?.toLowerCase().endsWith('.epub'))
  if (!epubFile) return null
  return `${ARCHIVE_PROXY}/download/${identifier}/${encodeURIComponent(epubFile.name)}`
}

// Client for Internet Archive's open Advanced Search API, scoped to
// items that are confirmed fully public domain and freely downloadable,
// not their lending library (which uses DRM and isn't meant to be
// extracted into a third-party reader).
//
// Every request that needs to be read by JS (search, file listings,
// the actual epub download) goes through the existing /api/fetch-book
// proxy, the same one already used for Gutenberg, since it generically
// fetches any absolute URL server-side with CORS-friendly headers.
// Cover images are the one exception, <img> tags don't need CORS to
// just display a picture, so those load directly from archive.org.

const ARCHIVE_ORIGIN = 'https://archive.org'

function viaProxy(absoluteUrl) {
  return `/api/fetch-book?url=${encodeURIComponent(absoluteUrl)}`
}

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
    cover: `${ARCHIVE_ORIGIN}/services/img/${identifier}`,
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
// there's no query-string way to filter by "has an epub file." This
// checks each result's real file listing directly, the same lookup
// used to download a book, and drops anything that doesn't actually
// have one. Items that pass get their epub URL resolved right away.
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
  const url = new URL(`${ARCHIVE_ORIGIN}/advancedsearch.php`)
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

  const res = await fetch(viaProxy(url.toString()))
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
// file listing once and finds the right one.
export async function resolveArchiveEpubUrl(identifier) {
  const res = await fetch(viaProxy(`${ARCHIVE_ORIGIN}/metadata/${identifier}`))
  if (!res.ok) throw new Error('Could not load this book\'s file listing')
  const data = await res.json()
  const files = data?.files || []
  const epubFile = files.find((f) => f.name?.toLowerCase().endsWith('.epub'))
  if (!epubFile) return null
  // This is the full absolute URL, fetchBookContent will wrap it
  // through the same /api/fetch-book proxy when actually downloading.
  return `${ARCHIVE_ORIGIN}/download/${identifier}/${encodeURIComponent(epubFile.name)}`
}

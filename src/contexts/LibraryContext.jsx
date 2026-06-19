import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import * as localdb from '../lib/db'

const LibraryContext = createContext(null)

export function LibraryProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [collection, setCollection] = useState([]) // array of book meta objects
  const [progressMap, setProgressMap] = useState({}) // bookId -> progress object
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const initialized = useRef(false)

  // Track connectivity
  useEffect(() => {
    function goOnline() { setIsOnline(true) }
    function goOffline() { setIsOnline(false) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Load local data immediately (fast, works offline), then reconcile with remote
  useEffect(() => {
    let cancelled = false

    async function init() {
      const localBooks = await localdb.getAllBooksMeta()
      const localProgress = await localdb.getAllProgressLocal()
      if (cancelled) return

      setCollection(localBooks)
      const pMap = {}
      localProgress.forEach((p) => { pMap[p.bookId] = p })
      setProgressMap(pMap)

      if (isAuthenticated && isOnline) {
        await reconcileWithRemote(localBooks, pMap)
      }
      initialized.current = true
    }

    init()
    return () => { cancelled = true }
  }, [isAuthenticated, user?.id])

  // Whenever we come back online and are authenticated, flush queued changes
  useEffect(() => {
    if (isOnline && isAuthenticated && initialized.current) {
      flushPendingSync()
    }
  }, [isOnline, isAuthenticated])

  async function reconcileWithRemote(localBooks, localProgressMap) {
    setSyncing(true)
    try {
      const { data: remoteBooks } = await supabase
        .from('collection_items')
        .select('*')
        .eq('user_id', user.id)

      const { data: remoteProgress } = await supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', user.id)

      // Merge books: union of local + remote, remote wins on conflict for metadata
      const merged = { ...Object.fromEntries(localBooks.map((b) => [b.id, b])) }
      for (const rb of remoteBooks || []) {
        merged[rb.book_id] = {
          id: rb.book_id,
          title: rb.title,
          author: rb.author,
          cover: rb.cover,
          source: rb.source,
          sourceId: rb.source_id,
          epubUrl: rb.epub_url,
          textUrl: rb.text_url,
          addedAt: rb.created_at,
        }
        await localdb.saveBookMeta(merged[rb.book_id])
      }
      setCollection(Object.values(merged))

      // Merge progress: last-write-wins by updatedAt
      const mergedProgress = { ...localProgressMap }
      for (const rp of remoteProgress || []) {
        const local = mergedProgress[rp.book_id]
        const remoteTime = new Date(rp.updated_at).getTime()
        const localTime = local?.updatedAt || 0
        if (!local || remoteTime > localTime) {
          mergedProgress[rp.book_id] = {
            bookId: rp.book_id,
            location: rp.location,
            percentage: rp.percentage,
            updatedAt: remoteTime,
          }
          await localdb.saveProgressLocal(rp.book_id, mergedProgress[rp.book_id])
        }
      }
      setProgressMap(mergedProgress)
    } catch (err) {
      console.error('Sync reconcile failed', err)
    } finally {
      setSyncing(false)
    }
  }

  async function flushPendingSync() {
    const pending = await localdb.getPendingSync()
    for (const entry of pending) {
      try {
        if (entry.type === 'progress') {
          await supabase.from('reading_progress').upsert({
            user_id: user.id,
            book_id: entry.bookId,
            location: entry.location,
            percentage: entry.percentage,
            updated_at: new Date(entry.updatedAt).toISOString(),
          })
        } else if (entry.type === 'add_book') {
          await supabase.from('collection_items').upsert({
            user_id: user.id,
            book_id: entry.book.id,
            title: entry.book.title,
            author: entry.book.author,
            cover: entry.book.cover,
            source: entry.book.source,
            source_id: entry.book.sourceId,
            epub_url: entry.book.epubUrl,
            text_url: entry.book.textUrl,
          })
        } else if (entry.type === 'remove_book') {
          await supabase.from('collection_items')
            .delete()
            .eq('user_id', user.id)
            .eq('book_id', entry.bookId)
        }
        await localdb.clearPendingSync(entry.id)
      } catch (err) {
        console.error('Failed to flush sync entry', entry, err)
        // leave it queued, try again next time
      }
    }
  }

  const addToCollection = useCallback(async (book) => {
    await localdb.saveBookMeta(book)
    setCollection((prev) => {
      if (prev.some((b) => b.id === book.id)) return prev
      return [...prev, book]
    })

    if (isAuthenticated && isOnline) {
      try {
        await supabase.from('collection_items').upsert({
          user_id: user.id,
          book_id: book.id,
          title: book.title,
          author: book.author,
          cover: book.cover,
          source: book.source,
          source_id: book.sourceId,
          epub_url: book.epubUrl,
          text_url: book.textUrl,
        })
        return
      } catch (err) {
        console.error('Remote add failed, queuing', err)
      }
    }
    await localdb.queuePendingSync({ type: 'add_book', book })
  }, [isAuthenticated, isOnline, user?.id])

  const removeFromCollection = useCallback(async (bookId) => {
    await localdb.deleteBookMeta(bookId)
    await localdb.deleteBookFile(bookId)
    setCollection((prev) => prev.filter((b) => b.id !== bookId))

    if (isAuthenticated && isOnline) {
      try {
        await supabase.from('collection_items')
          .delete()
          .eq('user_id', user.id)
          .eq('book_id', bookId)
        return
      } catch (err) {
        console.error('Remote remove failed, queuing', err)
      }
    }
    await localdb.queuePendingSync({ type: 'remove_book', bookId })
  }, [isAuthenticated, isOnline, user?.id])

  const saveProgress = useCallback(async (bookId, { location, percentage }) => {
    const updatedAt = Date.now()
    const progress = { bookId, location, percentage, updatedAt }
    await localdb.saveProgressLocal(bookId, progress)
    setProgressMap((prev) => ({ ...prev, [bookId]: progress }))

    if (isAuthenticated && isOnline) {
      try {
        await supabase.from('reading_progress').upsert({
          user_id: user.id,
          book_id: bookId,
          location,
          percentage,
          updated_at: new Date(updatedAt).toISOString(),
        })
        return
      } catch (err) {
        console.error('Remote progress save failed, queuing', err)
      }
    }
    await localdb.queuePendingSync({ type: 'progress', bookId, location, percentage, updatedAt })
  }, [isAuthenticated, isOnline, user?.id])

  const getProgress = useCallback((bookId) => progressMap[bookId] || null, [progressMap])

  const isInCollection = useCallback(
    (bookId) => collection.some((b) => b.id === bookId),
    [collection]
  )

  const value = {
    collection,
    progressMap,
    isOnline,
    syncing,
    addToCollection,
    removeFromCollection,
    saveProgress,
    getProgress,
    isInCollection,
  }

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary() {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider')
  return ctx
}

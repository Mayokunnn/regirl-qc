import { useState, useEffect, useRef } from 'react'

// Module-level cache shared across screen mounts. Survives navigation (but not a
// full page reload), so switching back to a screen shows its last data instantly
// while a fresh fetch runs in the background (stale-while-revalidate).
const cache = new Map()

// Invalidate a cached key (or all keys) after a mutation so the next read refetches.
export function invalidateCache(key) {
  if (key === undefined) cache.clear()
  else cache.delete(key)
}

// Manually seed/replace a cache entry (e.g. after creating an item locally).
export function setCache(key, data) {
  cache.set(key, data)
}

/**
 * useCachedFetch(key, fetcher)
 * - Returns cached data immediately if present (loading=false), then revalidates.
 * - On first ever load, loading=true until the fetch resolves.
 * - `refetch()` forces a fresh fetch and updates the cache.
 */
export function useCachedFetch(key, fetcher) {
  const [data, setData] = useState(() => (cache.has(key) ? cache.get(key) : null))
  const [loading, setLoading] = useState(() => !cache.has(key))
  const [error, setError] = useState(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    const hasCached = cache.has(key)
    if (hasCached) {
      setData(cache.get(key))
      setLoading(false)
    } else {
      setLoading(true)
    }

    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return
        cache.set(key, result)
        setData(result)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        if (!hasCached) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [key])

  function refetch() {
    return fetcherRef
      .current()
      .then((result) => {
        cache.set(key, result)
        setData(result)
        setError(null)
        return result
      })
      .catch((err) => {
        setError(err)
        throw err
      })
  }

  return { data, loading, error, refetch }
}

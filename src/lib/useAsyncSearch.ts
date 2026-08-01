import { useEffect, useRef, useState } from 'react'

import { useDebouncedValue } from './useDebouncedValue'

type Options<T> = {
  /** Runs the actual search. Receives the trimmed term and an abort signal. */
  fetcher: (term: string, signal: AbortSignal) => Promise<T[]>
  /** Debounce window in ms — one request fires after typing settles. */
  delay?: number
  /** Terms shorter than this never hit the network. */
  minLength?: number
  /** Gate the search off entirely (e.g. wrong tab / a selection is active). */
  enabled?: boolean
  /** Starting query text. */
  initialQuery?: string
  /** Called when a non-aborted request fails. Results are cleared first. */
  onError?: (error: unknown) => void
}

type AsyncSearch<T> = {
  query: string
  setQuery: (q: string) => void
  results: T[]
  loading: boolean
  /** Re-run the current term even if it was already fetched. */
  retry: () => void
  /** Clear query + results immediately. */
  reset: () => void
}

function isAbort(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name
  return name === 'AbortError' || name === 'CanceledError'
}

/**
 * Reusable, server-friendly typeahead search. One hook gives every search input
 * the same safe behaviour:
 *
 *  - **Debounced**: a request fires only after typing settles (`delay`).
 *  - **Min length**: terms below `minLength` never hit the network.
 *  - **Deduped**: an identical consecutive term is not re-fetched.
 *  - **Abortable**: the in-flight request is cancelled when the term changes,
 *    the search is disabled, or the component unmounts.
 *  - **Race-safe**: only the latest response is allowed to update state, so a
 *    slow earlier request can never overwrite newer results.
 */
export function useAsyncSearch<T>({
  fetcher,
  delay = 300,
  minLength = 2,
  enabled = true,
  initialQuery = '',
  onError,
}: Options<T>): AsyncSearch<T> {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const debounced = useDebouncedValue(query.trim(), delay)
  // The term whose results we currently hold, so we can skip duplicate fetches.
  const fetchedTermRef = useRef<string | null>(null)

  // Keep the latest callbacks without making them effect dependencies (which
  // would re-trigger searches on every render).
  const fetcherRef = useRef(fetcher)
  const onErrorRef = useRef(onError)
  fetcherRef.current = fetcher
  onErrorRef.current = onError

  useEffect(() => {
    if (!enabled || debounced.length < minLength) {
      setResults([])
      setLoading(false)
      fetchedTermRef.current = null
      return
    }
    if (fetchedTermRef.current === debounced) return // already have these results

    const controller = new AbortController()
    setLoading(true)
    fetcherRef
      .current(debounced, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        fetchedTermRef.current = debounced
        setResults(data)
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbort(error)) return
        fetchedTermRef.current = null
        setResults([])
        onErrorRef.current?.(error)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [debounced, enabled, minLength, retryToken])

  const retry = () => {
    fetchedTermRef.current = null
    setRetryToken((token) => token + 1)
  }

  const reset = () => {
    setQuery('')
    setResults([])
    setLoading(false)
    fetchedTermRef.current = null
  }

  return { query, setQuery, results, loading, retry, reset }
}

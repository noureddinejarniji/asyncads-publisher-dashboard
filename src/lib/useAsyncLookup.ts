import { useEffect, useRef, useState } from 'react'

import { useDebouncedValue } from './useDebouncedValue'

type Options<T> = {
  /** The value to look up (e.g. a domain). Debounced internally. */
  input: string
  /** Runs the lookup. Receives the trimmed input and an abort signal. */
  fetcher: (input: string, signal: AbortSignal) => Promise<T | null>
  /** Debounce window in ms — one request fires after the input settles. */
  delay?: number
  /** Inputs shorter than this never hit the network. */
  minLength?: number
  /** Gate the lookup off entirely. */
  enabled?: boolean
}

type AsyncLookup<T> = {
  value: T | null
  loading: boolean
}

function isAbort(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name
  return name === 'AbortError' || name === 'CanceledError'
}

/**
 * Single-value sibling of {@link useAsyncSearch}: resolve one derived value for
 * the current input (a site title, an icon, a lookup) with the same safety —
 * debounced, abortable, deduped, and race-safe (only the latest response wins).
 *
 * Unlike useAsyncSearch it doesn't own the input; you feed it whatever string
 * you already have, so it composes with an existing text field.
 */
export function useAsyncLookup<T>({ input, fetcher, delay = 300, minLength = 1, enabled = true }: Options<T>): AsyncLookup<T> {
  const [value, setValue] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const debounced = useDebouncedValue(input.trim(), delay)
  const fetchedRef = useRef<string | null>(null)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (!enabled || debounced.length < minLength) {
      setValue(null)
      setLoading(false)
      fetchedRef.current = null
      return
    }
    if (fetchedRef.current === debounced) return // already resolved this input

    const controller = new AbortController()
    setLoading(true)
    fetcherRef
      .current(debounced, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        fetchedRef.current = debounced
        setValue(result)
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbort(error)) return
        fetchedRef.current = debounced
        setValue(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [debounced, enabled, minLength])

  return { value, loading }
}

import { useEffect, useState } from 'react'

/**
 * Returns a copy of `value` that only updates after `delay` ms have passed with
 * no further changes. Use it to keep a fast, responsive input while throttling
 * whatever the value drives (filtering, a network request, etc.).
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

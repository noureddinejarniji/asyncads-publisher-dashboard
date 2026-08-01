import { useCallback, useEffect, useMemo } from 'react'
import { fetchFailure, fetchStart, fetchSuccess, pruneOldEntries, refreshStart } from './cacheSlice'
import { cacheKeyFor, isCacheFresh, MAX_CACHE_ENTRIES } from './cache'
import { useAppDispatch, useAppSelector } from './index'

type Fetcher<T> = (signal: AbortSignal) => Promise<T>

type UseCachedSectionOptions<T> = {
  key: string
  params?: Record<string, unknown>
  ttl: number
  enabled?: boolean
  fetcher: Fetcher<T>
}

type InFlight = {
  controller: AbortController
  promise: Promise<unknown>
  subscribers: number
}

const inFlight = new Map<string, InFlight>()

function errorText(error: unknown) {
  if (error instanceof DOMException && error.name === 'AbortError') return ''
  return error instanceof Error ? error.message : 'Unable to load data.'
}

export function useCachedSection<T>({
  key,
  params,
  ttl,
  enabled = true,
  fetcher,
}: UseCachedSectionOptions<T>) {
  const dispatch = useAppDispatch()
  const fullKey = useMemo(() => cacheKeyFor(key, params), [key, params])
  const entry = useAppSelector((state) => state.cache[fullKey])
  const data = (entry?.data ?? null) as T | null

  const startRequest = useCallback(
    (force = false) => {
      const current = inFlight.get(fullKey)
      if (current) return current.promise

      const controller = new AbortController()
      const hasData = data !== null
      dispatch(hasData ? refreshStart(fullKey) : fetchStart(fullKey))

      const promise = fetcher(controller.signal)
        .then((next) => {
          dispatch(fetchSuccess({ key: fullKey, data: next }))
          dispatch(pruneOldEntries({ prefix: key, maxEntries: MAX_CACHE_ENTRIES }))
          return next
        })
        .catch((error) => {
          const message = errorText(error)
          if (message) dispatch(fetchFailure({ key: fullKey, error: message }))
          throw error
        })
        .finally(() => {
          inFlight.delete(fullKey)
        })

      inFlight.set(fullKey, { controller, promise, subscribers: force ? 0 : 1 })
      return promise
    },
    [data, dispatch, fetcher, fullKey, key],
  )

  useEffect(() => {
    if (!enabled) return undefined
    if (data !== null && isCacheFresh(entry?.lastFetched, ttl)) return undefined

    const existing = inFlight.get(fullKey)
    if (existing) {
      existing.subscribers += 1
    } else {
      startRequest().catch(() => undefined)
    }

    return () => {
      const active = inFlight.get(fullKey)
      if (!active) return
      active.subscribers -= 1
      window.setTimeout(() => {
        const latest = inFlight.get(fullKey)
        if (latest && latest.subscribers <= 0) latest.controller.abort()
      }, 100)
    }
  }, [data, enabled, entry?.lastFetched, fullKey, startRequest, ttl])

  const refetch = useCallback(() => startRequest(true).catch(() => undefined), [startRequest])

  return {
    data,
    status: entry?.status ?? 'idle',
    error: entry?.error ?? null,
    isLoading: data === null && (entry?.status === 'loading' || entry?.status === 'idle'),
    isRefreshing: entry?.isRefreshing ?? false,
    refetch,
  }
}

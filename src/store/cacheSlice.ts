import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type CacheStatus = 'idle' | 'loading' | 'succeeded' | 'failed'

export type CacheEntry<T = unknown> = {
  data: T | null
  status: CacheStatus
  error: string | null
  lastFetched: number | null
  isRefreshing: boolean
}

export type CacheState = Record<string, CacheEntry>

const initialState: CacheState = {}

function entryFor(state: CacheState, key: string) {
  state[key] ??= {
    data: null,
    status: 'idle',
    error: null,
    lastFetched: null,
    isRefreshing: false,
  }
  return state[key]
}

const cacheSlice = createSlice({
  name: 'cache',
  initialState,
  reducers: {
    fetchStart(state, action: PayloadAction<string>) {
      const entry = entryFor(state, action.payload)
      entry.status = 'loading'
      entry.error = null
      entry.isRefreshing = false
    },
    refreshStart(state, action: PayloadAction<string>) {
      const entry = entryFor(state, action.payload)
      entry.status = entry.data === null ? 'loading' : 'succeeded'
      entry.error = null
      entry.isRefreshing = entry.data !== null
    },
    fetchSuccess(state, action: PayloadAction<{ key: string; data: unknown }>) {
      const entry = entryFor(state, action.payload.key)
      entry.data = action.payload.data
      entry.status = 'succeeded'
      entry.error = null
      entry.lastFetched = Date.now()
      entry.isRefreshing = false
    },
    fetchFailure(state, action: PayloadAction<{ key: string; error: string }>) {
      const entry = entryFor(state, action.payload.key)
      entry.status = entry.data === null ? 'failed' : 'succeeded'
      entry.error = action.payload.error
      entry.isRefreshing = false
    },
    invalidate(state, action: PayloadAction<string>) {
      delete state[action.payload]
    },
    invalidateByPrefix(state, action: PayloadAction<string>) {
      for (const key of Object.keys(state)) {
        if (key.startsWith(action.payload)) delete state[key]
      }
    },
    pruneOldEntries(state, action: PayloadAction<{ prefix: string; maxEntries: number }>) {
      const entries = Object.entries(state)
        .filter(([key]) => key.startsWith(action.payload.prefix))
        .sort((a, b) => (a[1].lastFetched ?? 0) - (b[1].lastFetched ?? 0))

      const excess = entries.length - action.payload.maxEntries
      if (excess <= 0) return
      for (const [key] of entries.slice(0, excess)) delete state[key]
    },
  },
})

export const {
  fetchStart,
  refreshStart,
  fetchSuccess,
  fetchFailure,
  invalidate,
  invalidateByPrefix,
  pruneOldEntries,
} = cacheSlice.actions

export default cacheSlice.reducer


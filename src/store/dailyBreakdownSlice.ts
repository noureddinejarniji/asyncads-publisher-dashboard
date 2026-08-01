import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

import { apiGet } from '../lib/auth'

export type DailyBreakdownRow = {
  date: string
  revenue: number
  impressions: number
  users: number
  clicks: number
  conversions: number
  approved: number
  pending: number
  rejected: number
  chargebacks: number
  offers: number
}

export type DailyBreakdownData = {
  range: string
  filters: { from: string; to: string }
  page: number
  perPage: number
  total: number
  totalPages: number
  /** Days of history since the publisher's first placement (null = none yet). */
  availableDays: number | null
  rows: DailyBreakdownRow[]
}

export type DailyBreakdownRequest = {
  range: string
  offer: string
  country: string
  placement: string
  page: number
  perPage?: number
  force?: boolean
}

type DailyBreakdownEntry = {
  data: DailyBreakdownData | null
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  loadedAt: number | null
}

export type DailyBreakdownState = {
  entries: Record<string, DailyBreakdownEntry>
}

const initialState: DailyBreakdownState = {
  entries: {},
}

export function dailyBreakdownKey(request: DailyBreakdownRequest) {
  const params = new URLSearchParams({
    range: request.range,
    page: String(request.page),
    perPage: String(request.perPage ?? 10),
  })
  if (request.offer !== 'all') params.set('offer', request.offer)
  if (request.country !== 'all') params.set('country', request.country)
  if (request.placement !== 'all') params.set('placement', request.placement)
  return params.toString()
}

function entryFor(state: DailyBreakdownState, key: string) {
  state.entries[key] ??= {
    data: null,
    status: 'idle',
    error: null,
    loadedAt: null,
  }
  return state.entries[key]
}

export const fetchDailyBreakdownPage = createAsyncThunk<
  { key: string; data: DailyBreakdownData },
  DailyBreakdownRequest,
  { state: { dailyBreakdown: DailyBreakdownState }; rejectValue: { key: string; error: string } }
>(
  'dailyBreakdown/fetchPage',
  async (request, { rejectWithValue, signal }) => {
    const key = dailyBreakdownKey(request)
    try {
      const data = await apiGet<DailyBreakdownData>(`/api/reports/daily-breakdown?${key}`, { signal })
      return { key, data }
    } catch (error) {
      return rejectWithValue({
        key,
        error: error instanceof Error ? error.message : 'Unable to load daily breakdown.',
      })
    }
  },
  {
    condition: (request, { getState }) => {
      const entry = getState().dailyBreakdown.entries[dailyBreakdownKey(request)]
      if (request.force) return entry?.status !== 'loading'
      return entry?.status !== 'loading' && entry?.status !== 'succeeded'
    },
  },
)

const dailyBreakdownSlice = createSlice({
  name: 'dailyBreakdown',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDailyBreakdownPage.pending, (state, action) => {
        const entry = entryFor(state, dailyBreakdownKey(action.meta.arg))
        entry.status = 'loading'
        entry.error = null
      })
      .addCase(fetchDailyBreakdownPage.fulfilled, (state, action) => {
        const entry = entryFor(state, action.payload.key)
        entry.data = action.payload.data
        entry.status = 'succeeded'
        entry.error = null
        entry.loadedAt = Date.now()
      })
      .addCase(fetchDailyBreakdownPage.rejected, (state, action) => {
        const key = action.payload?.key ?? dailyBreakdownKey(action.meta.arg)
        const entry = entryFor(state, key)
        entry.status = 'failed'
        entry.error = action.payload?.error ?? action.error.message ?? 'Unable to load daily breakdown.'
      })
  },
})

export default dailyBreakdownSlice.reducer

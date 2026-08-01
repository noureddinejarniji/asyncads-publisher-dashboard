import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

import { apiGet } from '../lib/auth'

export type ReportChartPoint = {
  date: string
  revenue: number
  users: number
  clicks: number
  conversions: number
  approved: number
  pending: number
  rejected: number
  chargebacks: number
  offers: number
}

export type ReportChartData = {
  range: string
  filters: { from: string; to: string }
  metrics?: string[]
  summary: {
    revenue: number
    clicks: number
    conversions: number
    users?: number
    chargebacks?: number
    offers?: number
  }
  series: ReportChartPoint[]
}

export type ReportChartRequest = {
  range: string
  offer: string
  country: string
  placement: string
  metrics: string[]
  force?: boolean
}

type ReportChartEntry = {
  data: ReportChartData | null
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  loadedAt: number | null
}

export type ReportChartState = {
  entries: Record<string, ReportChartEntry>
}

const initialState: ReportChartState = {
  entries: {},
}

export function reportChartKey(request: ReportChartRequest) {
  const params = new URLSearchParams({
    range: request.range,
    metrics: request.metrics.join(','),
  })
  if (request.offer !== 'all') params.set('offer', request.offer)
  if (request.country !== 'all') params.set('country', request.country)
  if (request.placement !== 'all') params.set('placement', request.placement)
  return params.toString()
}

function entryFor(state: ReportChartState, key: string) {
  state.entries[key] ??= {
    data: null,
    status: 'idle',
    error: null,
    loadedAt: null,
  }
  return state.entries[key]
}

export const fetchReportChart = createAsyncThunk<
  { key: string; data: ReportChartData },
  ReportChartRequest,
  { state: { reportChart: ReportChartState }; rejectValue: { key: string; error: string } }
>(
  'reportChart/fetch',
  async (request, { rejectWithValue, signal }) => {
    const key = reportChartKey(request)
    try {
      const data = await apiGet<ReportChartData>(`/api/reports/chart?${key}`, { signal })
      return { key, data }
    } catch (error) {
      return rejectWithValue({
        key,
        error: error instanceof Error ? error.message : 'Unable to load chart.',
      })
    }
  },
  {
    condition: (request, { getState }) => {
      const entry = getState().reportChart.entries[reportChartKey(request)]
      if (request.force) return entry?.status !== 'loading'
      return entry?.status !== 'loading' && entry?.status !== 'succeeded'
    },
  },
)

const reportChartSlice = createSlice({
  name: 'reportChart',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchReportChart.pending, (state, action) => {
        const entry = entryFor(state, reportChartKey(action.meta.arg))
        entry.status = 'loading'
        entry.error = null
      })
      .addCase(fetchReportChart.fulfilled, (state, action) => {
        const entry = entryFor(state, action.payload.key)
        entry.data = action.payload.data
        entry.status = 'succeeded'
        entry.error = null
        entry.loadedAt = Date.now()
      })
      .addCase(fetchReportChart.rejected, (state, action) => {
        const key = action.payload?.key ?? reportChartKey(action.meta.arg)
        const entry = entryFor(state, key)
        entry.status = 'failed'
        entry.error = action.payload?.error ?? action.error.message ?? 'Unable to load chart.'
      })
  },
})

export default reportChartSlice.reducer

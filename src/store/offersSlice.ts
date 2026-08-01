import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

import { apiGet } from '../lib/auth'

export type StoredOffer = {
  slug: string
  name: string
}

type OffersResponse = {
  offers?: StoredOffer[]
}

export type OffersState = {
  items: StoredOffer[]
  status: 'idle' | 'loading' | 'succeeded' | 'failed'
  error: string | null
  loadedAt: number | null
}

const initialState: OffersState = {
  items: [],
  status: 'idle',
  error: null,
  loadedAt: null,
}

export const fetchOffersOnce = createAsyncThunk<
  StoredOffer[],
  void,
  { state: { offers: OffersState }; rejectValue: string }
>(
  'offers/fetchOnce',
  async (_, { rejectWithValue, signal }) => {
    try {
      const data = await apiGet<OffersResponse>('/api/offers?limit=10', { signal })
      return data.offers ?? []
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Unable to load offers.')
    }
  },
  {
    condition: (_, { getState }) => {
      const { status } = getState().offers
      return status !== 'loading' && status !== 'succeeded'
    },
  },
)

const offersSlice = createSlice({
  name: 'offers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchOffersOnce.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(fetchOffersOnce.fulfilled, (state, action) => {
        state.items = action.payload
        state.status = 'succeeded'
        state.error = null
        state.loadedAt = Date.now()
      })
      .addCase(fetchOffersOnce.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? action.error.message ?? 'Unable to load offers.'
      })
  },
})

export default offersSlice.reducer

import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux'
import cacheReducer from './cacheSlice'
import dailyBreakdownReducer from './dailyBreakdownSlice'
import offersReducer from './offersSlice'
import reportChartReducer from './reportChartSlice'

export const store = configureStore({
  reducer: {
    cache: cacheReducer,
    dailyBreakdown: dailyBreakdownReducer,
    offers: offersReducer,
    reportChart: reportChartReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

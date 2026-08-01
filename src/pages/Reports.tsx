import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  MousePointerClick,
  Percent,
  SlidersHorizontal,
} from 'lucide-react'

import InlineSpinner from '../components/InlineSpinner'
import LazyAreaChart from '../components/lazy/LazyAreaChart'
import { GRID_CELL, GRID_HEAD, gridRow } from '../lib/tableStyles'
import { useAppDispatch, useAppSelector } from '../store'
import { dailyBreakdownKey, fetchDailyBreakdownPage } from '../store/dailyBreakdownSlice'
import { fetchReportChart, reportChartKey } from '../store/reportChartSlice'

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'
const DAILY_PAGE_SIZE = 10

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = (n: number) => Number(n).toLocaleString()

type SeriesPoint = {
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

type MetricKey = 'value' | 'clicks' | 'conversions' | 'users'
type RangeKey = '7d' | '30d' | '90d'

const REPORT_RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
]

const CHART_METRICS: { key: MetricKey; label: string; dot: string; active: string }[] = [
  { key: 'value', label: 'Revenue', dot: 'bg-brand-fuchsia', active: 'border-brand-fuchsia/40 bg-brand-fuchsia/5 text-brand-fuchsia' },
  { key: 'clicks', label: 'Clicks', dot: 'bg-emerald-500', active: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { key: 'conversions', label: 'Conversions', dot: 'bg-amber-500', active: 'border-amber-300 bg-amber-50 text-amber-700' },
  { key: 'users', label: 'Users', dot: 'bg-blue-500', active: 'border-blue-300 bg-blue-50 text-blue-700' },
]

// The chart always fetches every series for the selected range; the metric
// toggles only show/hide lines (and never change the request), so flipping a
// metric never refetches or re-spins the KPI cards.
const ALL_CHART_METRICS: MetricKey[] = ['value', 'clicks', 'conversions', 'users']

type DailyColumnKey = keyof SeriesPoint | 'earning' | 'dau' | 'ctr' | 'ecpm' | 'cvr' | 'rpc' | 'arpu'

type DailyColumn = {
  key: DailyColumnKey
  label: string
  align?: 'right'
  /** The `date` column is the row identity and is always shown / not toggleable. */
  fixed?: boolean
  /** Whether the column is visible on first load before the user picks metrics. */
  defaultOn?: boolean
  /** Short explanation shown in the metric picker. */
  description?: string
}

const DAILY_COLUMNS: DailyColumn[] = [
  { key: 'date', label: 'Day', fixed: true },
  { key: 'earning', label: 'Daily earning', align: 'right', defaultOn: true, description: 'Approved revenue for the day' },
  { key: 'dau', label: 'DAU', align: 'right', defaultOn: true, description: 'Distinct active users' },
  { key: 'impressions', label: 'Impressions', align: 'right', defaultOn: true, description: 'Wall loads' },
  { key: 'clicks', label: 'Clicks', align: 'right', defaultOn: true, description: 'Offers started' },
  { key: 'conversions', label: 'Conversions', align: 'right', defaultOn: true, description: 'Completed conversions' },
  { key: 'ctr', label: 'CTR', align: 'right', defaultOn: true, description: 'Click-through rate — clicks ÷ impressions' },
  { key: 'ecpm', label: 'eCPM', align: 'right', defaultOn: true, description: 'Revenue per 1,000 impressions' },
  { key: 'cvr', label: 'CVR', align: 'right', defaultOn: true, description: 'Conversion rate — conversions ÷ clicks' },
  { key: 'rpc', label: 'RPC', align: 'right', defaultOn: true, description: 'Revenue per click' },
  { key: 'arpu', label: 'ARPU', align: 'right', defaultOn: true, description: 'Avg revenue per active user' },
  { key: 'chargebacks', label: 'Chargebacks', align: 'right', description: 'Reversed / charged-back conversions' },
  { key: 'offers', label: 'Unique offers', align: 'right', description: 'Distinct offers with activity' },
]

// Bumped to v2 so the wider default metric set (CTR/eCPM/CVR/RPC/ARPU) applies
// to publishers who already had a saved v1 selection.
const DAILY_COLUMN_STORAGE_KEY = 'reports.dailyBreakdown.metrics.v2'
const DEFAULT_DAILY_KEYS = DAILY_COLUMNS.filter((c) => c.fixed || c.defaultOn).map((c) => c.key)

/** Reads the saved metric selection, falling back to defaults. `date` is always kept. */
function loadDailyMetricKeys(): DailyColumnKey[] {
  if (typeof window === 'undefined') return DEFAULT_DAILY_KEYS
  try {
    const raw = window.localStorage.getItem(DAILY_COLUMN_STORAGE_KEY)
    if (!raw) return DEFAULT_DAILY_KEYS
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_DAILY_KEYS
    const valid = DAILY_COLUMNS.filter((c) => c.fixed || parsed.includes(c.key)).map((c) => c.key)
    return valid.length > 0 ? valid : DEFAULT_DAILY_KEYS
  } catch {
    return DEFAULT_DAILY_KEYS
  }
}


function fmtDay(value: string) {
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function DailyCell({ row, column }: { row: SeriesPoint; column: (typeof DAILY_COLUMNS)[number] }) {
  if (column.key === 'date') {
    return (
      <div>
        <p className="font-semibold text-slate-900">{fmtDay(row.date)}</p>
        <p className="font-mono text-[11px] text-slate-400">{row.date}</p>
      </div>
    )
  }

  if (column.key === 'earning') {
    return <span className="font-semibold tabular-nums text-slate-900">{usd(row.revenue)}</span>
  }

  if (column.key === 'dau') {
    return <span className="tabular-nums text-slate-700">{num(row.users)}</span>
  }

  if (column.key === 'ctr') {
    const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0
    return <span className="tabular-nums text-slate-700">{ctr.toFixed(2)}%</span>
  }

  if (column.key === 'ecpm') {
    const ecpm = row.impressions > 0 ? (row.revenue / row.impressions) * 1000 : 0
    return <span className="tabular-nums text-slate-700">{usd(ecpm)}</span>
  }

  if (column.key === 'cvr') {
    const cvr = row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0
    return <span className="tabular-nums text-slate-700">{cvr.toFixed(2)}%</span>
  }

  if (column.key === 'rpc') {
    const rpc = row.clicks > 0 ? row.revenue / row.clicks : 0
    return <span className="tabular-nums text-slate-700">{usd(rpc)}</span>
  }

  if (column.key === 'arpu') {
    const arpu = row.users > 0 ? row.revenue / row.users : 0
    return <span className="tabular-nums text-slate-700">{usd(arpu)}</span>
  }

  if (column.key === 'chargebacks') {
    return (
      <span
        className={`inline-flex min-w-8 justify-center border px-2 py-0.5 text-xs font-semibold tabular-nums ${
          row.chargebacks > 0
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-slate-200 bg-slate-50 text-slate-400'
        }`}
      >
        {num(row.chargebacks)}
      </span>
    )
  }

  return <span className="tabular-nums text-slate-600">{num(Number(row[column.key] ?? 0))}</span>
}

/** Dropdown that lets the user choose which breakdown metrics (columns) are shown. */
function MetricsPicker({
  selected,
  onToggle,
  onReset,
}: {
  selected: DailyColumnKey[]
  onToggle: (key: DailyColumnKey) => void
  onReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const toggleable = DAILY_COLUMNS.filter((column) => !column.fixed)
  const activeCount = toggleable.filter((column) => selected.includes(column.key)).length

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEsc = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
      >
        <SlidersHorizontal size={15} className="text-slate-400" />
        Metrics
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-500">{activeCount}</span>
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-72 rounded-xl border border-slate-200 bg-white py-2 shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between px-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Choose metrics</p>
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-semibold text-brand-fuchsia transition-colors hover:text-brand-fuchsia/80"
            >
              Reset
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {toggleable.map((column) => {
              const checked = selected.includes(column.key)
              const isLast = checked && selected.length <= 2 // keep at least Day + one metric
              return (
                <button
                  key={column.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  disabled={isLast}
                  onClick={() => onToggle(column.key)}
                  className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
                      checked ? 'border-brand-fuchsia bg-brand-fuchsia text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {checked && <Check size={12} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-700">{column.label}</span>
                    {column.description && <span className="block text-xs text-slate-400">{column.description}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const dispatch = useAppDispatch()
  const [series, setSeries] = useState<Record<MetricKey, boolean>>({ value: true, clicks: false, conversions: false, users: false })
  const [range, setRange] = useState<RangeKey>('7d')
  // Offer / country / app filtering is disabled — reports always span every offer, country, and app.
  const offer = 'all'
  const country = 'all'
  const placement = 'all'
  const [dailyPage, setDailyPage] = useState(1)
  // Which breakdown columns the user has chosen to see. Defaults on first load,
  // then persisted so the choice sticks across sessions.
  const [metricKeys, setMetricKeys] = useState<DailyColumnKey[]>(loadDailyMetricKeys)
  const activeColumns = useMemo(() => DAILY_COLUMNS.filter((column) => metricKeys.includes(column.key)), [metricKeys])
  const toggleMetric = (key: DailyColumnKey) =>
    setMetricKeys((keys) => {
      const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
      return DAILY_COLUMNS.filter((column) => column.fixed || next.includes(column.key)).map((column) => column.key)
    })
  const resetMetrics = () => setMetricKeys(DEFAULT_DAILY_KEYS)

  useEffect(() => {
    try {
      window.localStorage.setItem(DAILY_COLUMN_STORAGE_KEY, JSON.stringify(metricKeys))
    } catch {
      // Ignore storage failures (private mode / disabled storage).
    }
  }, [metricKeys])
  const selectedRange = REPORT_RANGES.find((item) => item.key === range) ?? REPORT_RANGES[0]
  const expectedDailyTotalPages = Math.max(1, Math.ceil(selectedRange.days / DAILY_PAGE_SIZE))
  const dailyRequestedPage = Math.min(dailyPage, expectedDailyTotalPages)
  const breakdownRequest = useMemo(
    () => ({
      range,
      offer,
      country,
      placement,
      page: dailyRequestedPage,
      perPage: DAILY_PAGE_SIZE,
    }),
    [country, dailyRequestedPage, offer, placement, range],
  )
  const breakdownKey = useMemo(() => dailyBreakdownKey(breakdownRequest), [breakdownRequest])
  const breakdownEntry = useAppSelector((state) => state.dailyBreakdown.entries[breakdownKey])
  const chartRequest = useMemo(
    () => ({
      range,
      offer,
      country,
      placement,
      metrics: ALL_CHART_METRICS,
    }),
    [country, offer, placement, range],
  )
  const chartKey = useMemo(() => reportChartKey(chartRequest), [chartRequest])
  const chartEntry = useAppSelector((state) => state.reportChart.entries[chartKey])

  const toggleSeries = (key: MetricKey) =>
    setSeries((s) => {
      const next = { ...s, [key]: !s[key] }
      return Object.values(next).some(Boolean) ? next : s
    })

  useEffect(() => {
    void dispatch(fetchReportChart(chartRequest))
  }, [chartRequest, dispatch])

  useEffect(() => {
    setDailyPage(1)
  }, [country, offer, placement, range])

  useEffect(() => {
    void dispatch(fetchDailyBreakdownPage(breakdownRequest))
  }, [breakdownRequest, dispatch])

  const chartDataResult = chartEntry?.data
  const chartInitialLoading = (!chartEntry || chartEntry.status === 'loading') && !chartDataResult
  const chartRefreshing = chartEntry?.status === 'loading' && Boolean(chartDataResult)
  const chartError = chartEntry?.status === 'failed' ? chartEntry.error ?? 'Unable to load chart.' : ''

  const chartData = (chartDataResult?.series ?? []).map((s) => ({
    label: fmtDay(s.date),
    value: s.revenue,
    clicks: s.clicks,
    conversions: s.conversions,
    users: s.users,
  }))
  const chartRevenue = chartDataResult?.summary.revenue ?? chartData.reduce((total, point) => total + point.value, 0)
  // Period totals derived from the (full-range) chart series — power the KPI strip.
  const periodTotals = chartData.reduce(
    (acc, p) => ({ clicks: acc.clicks + (p.clicks || 0), conversions: acc.conversions + (p.conversions || 0) }),
    { clicks: 0, conversions: 0 },
  )
  const convRate = periodTotals.clicks > 0 ? (periodTotals.conversions / periodTotals.clicks) * 100 : 0
  const kpis = [
    { label: 'Revenue', value: usd(chartRevenue), icon: DollarSign, tile: 'bg-brand-fuchsia/10 text-brand-fuchsia' },
    { label: 'Clicks', value: num(periodTotals.clicks), icon: MousePointerClick, tile: 'bg-emerald-50 text-emerald-600' },
    { label: 'Conversions', value: num(periodTotals.conversions), icon: BadgeCheck, tile: 'bg-amber-50 text-amber-600' },
    { label: 'Conv. rate', value: `${convRate.toFixed(2)}%`, icon: Percent, tile: 'bg-blue-50 text-blue-600' },
  ]
  const breakdownData = breakdownEntry?.data
  // A longer range is only useful if the publisher has history past the previous
  // range's window. With e.g. 3 days of history, 30d/90d add nothing → disabled.
  const availableDays = breakdownData?.availableDays ?? null
  const rangeEnabled = (index: number) =>
    index === 0 || (availableDays != null && availableDays > REPORT_RANGES[index - 1].days)
  const dailyRows = breakdownData?.rows ?? []
  const dailyTotal = breakdownData?.total ?? selectedRange.days
  const dailyTotalPages = breakdownData?.totalPages ?? expectedDailyTotalPages
  const dailyCurrentPage = breakdownData?.page ?? dailyRequestedPage
  const dailyStart = dailyRows.length === 0 ? 0 : (dailyCurrentPage - 1) * DAILY_PAGE_SIZE + 1
  const dailyEnd = dailyRows.length === 0 ? 0 : Math.min(dailyTotal, dailyStart + dailyRows.length - 1)
  const breakdownInitialLoading = (!breakdownEntry || breakdownEntry.status === 'loading') && !breakdownData
  const breakdownRefreshing = breakdownEntry?.status === 'loading' && Boolean(breakdownData)
  const breakdownError = breakdownEntry?.status === 'failed' ? breakdownEntry.error ?? 'Unable to load daily breakdown.' : ''
  // One global indicator next to the page title covers every section's loading.
  const anyLoading = chartInitialLoading || chartRefreshing || breakdownInitialLoading || breakdownRefreshing
  const tableColSpan = activeColumns.length

  useEffect(() => {
    if (dailyPage > expectedDailyTotalPages) setDailyPage(expectedDailyTotalPages)
  }, [dailyPage, expectedDailyTotalPages])

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold tracking-tight text-slate-900">
            Reports
            {anyLoading && <InlineSpinner className="h-5 w-5" />}
          </h1>
          <p className="mt-1 text-slate-500">Review daily performance across earnings, users, offers, and chargebacks.</p>
        </div>
        {/* Inline date-range segmented control — matches the Overview filter. */}
        <div className="inline-flex flex-wrap gap-1 self-start rounded-xl border border-slate-200 bg-slate-50 p-1">
          {REPORT_RANGES.map((option, index) => {
            const selected = option.key === range
            const enabled = rangeEnabled(index)
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => enabled && setRange(option.key)}
                disabled={!enabled}
                aria-pressed={selected}
                title={enabled ? undefined : 'Not enough history yet for this range.'}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected
                    ? 'bg-white text-brand-fuchsia shadow-sm'
                    : enabled
                      ? 'text-slate-500 hover:text-slate-900'
                      : 'cursor-not-allowed text-slate-300'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* KPI summary for the selected period */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className={`${CARD} p-5`}>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${k.tile}`}>
                <Icon size={20} />
              </span>
              <p className="mt-4 text-sm text-slate-500">{k.label}</p>
              <p className="mt-1 flex min-h-8 items-center font-display text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                {chartInitialLoading ? <InlineSpinner className="h-5 w-5" /> : k.value}
              </p>
            </div>
          )
        })}
      </div>

      <div className={`${CARD} mb-6 p-6`}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Revenue Summary</h2>
            <p className="mt-0.5 inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight tabular-nums text-slate-900">
              {chartInitialLoading ? <InlineSpinner /> : usd(chartRevenue)}
              <span className="font-sans text-sm font-normal text-slate-400">last {selectedRange.days} days</span>
            </p>
          </div>
          {/* Metric series toggles — live on the chart */}
          <div className="flex flex-wrap gap-1.5">
            {CHART_METRICS.map((m) => {
              const on = series[m.key]
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => toggleSeries(m.key)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    on ? m.active : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${on ? m.dot : 'bg-slate-300'}`} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
        {chartInitialLoading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
            <InlineSpinner className="mr-2" /> Loading revenue
          </div>
        ) : chartError && !chartDataResult ? (
          <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-red-500">
            {chartError}
          </div>
        ) : chartData.length ? (
          <LazyAreaChart data={chartData} visible={series} />
        ) : (
          <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
            No data for this range.
          </div>
        )}
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="border-b border-slate-100 bg-white">
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Daily Breakdown</h2>
              <p className="mt-0.5 text-sm text-slate-400">
                {breakdownInitialLoading
                  ? 'Loading daily data'
                  : `${dailyTotal} day${dailyTotal === 1 ? '' : 's'} of performance data`}
              </p>
            </div>
            <MetricsPicker selected={metricKeys} onToggle={toggleMetric} onReset={resetMetrics} />
          </div>
        </div>
        <div className="max-h-[680px] overflow-auto">
          <table className="min-w-max w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                {activeColumns.map((column) => (
                  <th key={column.key} className={`${GRID_HEAD} sticky top-0 z-20 ${column.align === 'right' ? 'text-right' : ''}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {breakdownInitialLoading ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-4 py-16 text-center text-sm text-slate-400">
                    <InlineSpinner className="mr-2 inline" /> Loading daily breakdown...
                  </td>
                </tr>
              ) : breakdownError && !dailyRows.length ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-4 py-16 text-center text-sm text-red-500">
                    {breakdownError}
                  </td>
                </tr>
              ) : dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="px-4 py-16 text-center text-sm text-slate-400">
                    No daily data for this range.
                  </td>
                </tr>
              ) : (
                dailyRows.map((row, rowIndex) => (
                  <tr key={row.date} className={gridRow(dailyStart + rowIndex - 1)}>
                    {activeColumns.map((column) => (
                      <td key={column.key} className={`${GRID_CELL} ${column.align === 'right' ? 'text-right' : ''}`}>
                        <DailyCell row={row} column={column} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {dailyTotal > DAILY_PAGE_SIZE && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm font-semibold text-slate-500">
              Showing {dailyStart}-{dailyEnd} of {dailyTotal}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDailyPage((page) => Math.max(1, page - 1))}
                disabled={dailyCurrentPage <= 1}
                className="inline-flex h-9 items-center gap-1.5 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ChevronLeft size={16} />
                Prev
              </button>
              <span className="min-w-16 text-center text-sm font-semibold text-slate-500">
                {dailyCurrentPage} / {dailyTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setDailyPage((page) => Math.min(dailyTotalPages, page + 1))}
                disabled={dailyCurrentPage >= dailyTotalPages}
                className="inline-flex h-9 items-center gap-1.5 border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}


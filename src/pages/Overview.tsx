import { useCallback, useState } from 'react'
import { Activity, Clock, DollarSign, KeyRound, LineChart, MousePointerClick, TrendingDown, TrendingUp, TriangleAlert, Users } from 'lucide-react'

import InlineSpinner from '../components/InlineSpinner'
import LazyAreaChart from '../components/lazy/LazyAreaChart'
import { apiGet } from '../lib/auth'
import { CACHE_TTL } from '../store/cache'
import { useCachedSection } from '../store/useCachedSection'

// Each Overview KPI card has its own endpoint, so each has its own payload.
type RevenueStat = { revenue: number; revenueDelta: number }
type ConversionsStat = { conversions: number; conversionsDelta: number }
type ActiveUsersStat = { activeUsers: number; activeUsersDelta?: number | null }
type EcpmStat = { ecpm: number }

type RevenueData = {
  series: {
    date?: string
    hour?: number
    label?: string
    value: number | string
    clicks?: number | string
    conversions?: number | string
    impressions?: number | string
  }[]
}

const CARD = 'relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 transition-all duration-200 hover:shadow-md'

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = (n: number) => Number(n).toLocaleString()
const REVENUE_RANGES = [
  { value: '7', label: '7 day' },
  { value: '30', label: '30 day' },
] as const

const STAT_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
] as const
type StatRange = (typeof STAT_RANGES)[number]['value']

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function dayLabel(key: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${key}T00:00:00Z`))
}

function dailyRevenueSeries(series: RevenueData['series'], days: number) {
  const byDate = new Map(
    series
      .filter((row) => row.date)
      .map((row) => [
        String(row.date).slice(0, 10),
        {
          value: Number(row.value),
          clicks: Number(row.clicks ?? 0),
          conversions: Number(row.conversions ?? 0),
          impressions: Number(row.impressions ?? 0),
        },
      ]),
  )
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - (days - 1 - index))
    const key = dateKey(date)
    const row = byDate.get(key)

    return {
      label: dayLabel(key),
      value: row?.value ?? 0,
      clicks: row?.clicks ?? 0,
      conversions: row?.conversions ?? 0,
      impressions: row?.impressions ?? 0,
    }
  })
}

// Visual error display block
function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-600">
      <div className="flex items-center gap-2">
        <TriangleAlert size={16} />
        <span className="min-w-0 flex-1 truncate">{message}</span>
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold text-red-700">
          Retry
        </button>
      </div>
    </div>
  )
}

/** Inline date-range selector for the overview stats — all options on one line. */
function StatRangeMenu({ value, onChange, busy }: { value: StatRange; onChange: (v: StatRange) => void; busy: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {busy && <InlineSpinner className="h-4 w-4" />}
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
        {STAT_RANGES.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selected ? 'bg-white text-brand-fuchsia shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ValueArea({ value, loading, refreshing }: { value: string; loading: boolean; refreshing: boolean }) {
  if (loading) {
    return (
      <span className="mt-1 inline-flex min-h-8 items-center" aria-label="Loading value">
        <InlineSpinner className="h-5 w-5" />
      </span>
    )
  }

  return (
    <span className="mt-1 inline-flex min-h-8 items-center gap-2 font-display text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
      {value}
      {refreshing && <InlineSpinner className="h-4 w-4" />}
    </span>
  )
}

type MetricKey = 'value' | 'clicks' | 'conversions'
const CHART_METRICS: { key: MetricKey; label: string; dot: string; active: string }[] = [
  { key: 'value', label: 'Revenue', dot: 'bg-brand-fuchsia', active: 'border-brand-fuchsia/40 bg-brand-fuchsia/5 text-brand-fuchsia' },
  { key: 'clicks', label: 'Clicks', dot: 'bg-emerald-500', active: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { key: 'conversions', label: 'Conversions', dot: 'bg-amber-500', active: 'border-amber-300 bg-amber-50 text-amber-700' },
]

export default function Overview() {
  const [statsRange, setStatsRange] = useState<StatRange>('today')
  const [revenueRange, setRevenueRange] = useState<(typeof REVENUE_RANGES)[number]['value']>('7')
  const [series, setSeries] = useState<Record<MetricKey, boolean>>({ value: true, clicks: true, conversions: true })
  // Keep at least one series on so the chart is never blank.
  const toggleSeries = (key: MetricKey) =>
    setSeries((s) => {
      const next = { ...s, [key]: !s[key] }
      return Object.values(next).some(Boolean) ? next : s
    })
  const fetchRevenueStat = useCallback(
    (signal: AbortSignal) => apiGet<RevenueStat>(`/api/dashboard/stats/revenue?range=${statsRange}`, { signal }),
    [statsRange],
  )
  const fetchConversionsStat = useCallback(
    (signal: AbortSignal) => apiGet<ConversionsStat>(`/api/dashboard/stats/conversions?range=${statsRange}`, { signal }),
    [statsRange],
  )
  const fetchActiveUsersStat = useCallback(
    (signal: AbortSignal) => apiGet<ActiveUsersStat>(`/api/dashboard/stats/active-users?range=${statsRange}`, { signal }),
    [statsRange],
  )
  const fetchEcpmStat = useCallback(
    (signal: AbortSignal) => apiGet<EcpmStat>(`/api/dashboard/stats/ecpm?range=${statsRange}`, { signal }),
    [statsRange],
  )
  const fetchRevenue = useCallback(
    (signal: AbortSignal) => apiGet<RevenueData>(`/api/dashboard/revenue?days=${revenueRange}`, { signal }),
    [revenueRange],
  )

  const ttl = CACHE_TTL['dashboard.stats']
  const revenueStat = useCachedSection({ key: 'dashboard.stat.revenue', params: { range: statsRange }, ttl, fetcher: fetchRevenueStat })
  const conversionsStat = useCachedSection({ key: 'dashboard.stat.conversions', params: { range: statsRange }, ttl, fetcher: fetchConversionsStat })
  const activeUsersStat = useCachedSection({ key: 'dashboard.stat.activeUsers', params: { range: statsRange }, ttl, fetcher: fetchActiveUsersStat })
  const ecpmStat = useCachedSection({ key: 'dashboard.stat.ecpm', params: { range: statsRange }, ttl, fetcher: fetchEcpmStat })
  const revenue = useCachedSection({
    key: 'dashboard.revenueChart',
    params: { days: revenueRange, metrics: 'overview-v2' },
    ttl: CACHE_TTL['dashboard.revenueChart'],
    fetcher: fetchRevenue,
  })

  const chartData = dailyRevenueSeries(revenue.data?.series ?? [], Number(revenueRange))
  const total = chartData.reduce((a, b) => a + b.value, 0)

  // Each card carries its own loading / refreshing / error from its own endpoint.
  const statCards = [
    {
      label: 'Revenue',
      value: revenueStat.data ? usd(Number(revenueStat.data.revenue)) : '',
      delta: revenueStat.data?.revenueDelta ?? null,
      icon: DollarSign,
      tone: 'fuchsia',
      section: revenueStat,
    },
    {
      label: 'Conversions',
      value: conversionsStat.data ? num(conversionsStat.data.conversions) : '',
      delta: conversionsStat.data?.conversionsDelta ?? null,
      icon: MousePointerClick,
      tone: 'green',
      section: conversionsStat,
    },
    {
      label: 'Active users',
      value: activeUsersStat.data ? num(activeUsersStat.data.activeUsers) : '',
      delta: activeUsersStat.data?.activeUsersDelta ?? null,
      icon: Users,
      tone: 'violet',
      section: activeUsersStat,
    },
    {
      label: 'eCPM',
      value: ecpmStat.data ? `$${Number(ecpmStat.data.ecpm).toFixed(2)}` : '',
      delta: null,
      icon: LineChart,
      tone: 'blue',
      section: ecpmStat,
    },
  ]
  const anyStatRefreshing = statCards.some((c) => c.section.isRefreshing)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Overview</h1>
          <p className="mt-1 text-slate-500">Welcome back. Here's how your offerwall is performing.</p>
        </div>
      </div>

      {/* Stats range filter */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Performance</h2>
        <StatRangeMenu value={statsRange} onChange={setStatsRange} busy={anyStatRefreshing} />
      </div>

      {/* Main Stats Row featuring Sparklines */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, delta, icon: Icon, tone, section }) => {
          const up = (delta ?? 0) >= 0
          const showError = section.error && !section.data
          return (
            <div key={label} className={`${CARD} p-5`}>
              <div className="flex items-center justify-between">
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${
                  tone === 'fuchsia' ? 'bg-brand-fuchsia/10 text-brand-fuchsia' :
                  tone === 'green' ? 'bg-emerald-50 text-emerald-600' :
                  tone === 'violet' ? 'bg-violet-50 text-violet-600' :
                  'bg-blue-50 text-blue-600'
                }`}>
                  <Icon size={20} />
                </span>
                {delta !== null && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {Math.abs(delta)}%
                  </span>
                )}
              </div>
              <p className="mt-4 text-sm text-slate-500">{label}</p>
              {showError ? (
                <button
                  type="button"
                  onClick={section.refetch}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-red-600"
                >
                  <TriangleAlert size={14} /> Failed — retry
                </button>
              ) : (
                <ValueArea value={value} loading={section.isLoading} refreshing={section.isRefreshing} />
              )}
            </div>
          )
        })}
      </div>

      {/* Main Chart Container */}
      <div className={`${CARD} p-6`}>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 text-lg">Revenue Summary</h2>
            <p className="mt-0.5 inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight tabular-nums text-slate-900">
              {revenue.isLoading ? <InlineSpinner /> : usd(total)}
              {revenue.isRefreshing && <InlineSpinner className="h-4 w-4" />}
              <span className="font-sans text-sm font-normal text-slate-400">last {revenueRange} days</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Metric filter chips */}
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
            {/* Range selector */}
            <div className="inline-flex self-start rounded-xl border border-slate-200 bg-slate-50 p-1">
              {REVENUE_RANGES.map((range) => (
                <button
                  key={range.value}
                  type="button"
                  onClick={() => setRevenueRange(range.value)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    revenueRange === range.value
                      ? 'bg-white text-brand-fuchsia shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {revenue.error && !revenue.data ? (
          <SectionError message={revenue.error} onRetry={revenue.refetch} />
        ) : revenue.isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-slate-400">
            <InlineSpinner className="mr-2" /> Loading revenue
          </div>
        ) : (
          <LazyAreaChart data={chartData} visible={series} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Conversions — disabled teaser; the feature isn't live yet. */}
        <div className={`${CARD} flex min-h-[300px] cursor-not-allowed select-none flex-col opacity-90`} aria-disabled="true">
          {/* Illustration zone — swap the gradient/icon for a generated illustration later. */}
          <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-brand-violet/15 via-brand-fuchsia/10 to-slate-50">
            <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-brand-fuchsia/10 blur-2xl" />
            <div className="pointer-events-none absolute right-8 top-6 h-2 w-2 rounded-full bg-brand-fuchsia/40" />
            <div className="pointer-events-none absolute bottom-8 left-10 h-1.5 w-1.5 rounded-full bg-brand-violet/40" />
            <span className="grid h-20 w-20 place-items-center rounded-3xl bg-white/70 text-brand-fuchsia shadow-sm ring-1 ring-brand-fuchsia/10 backdrop-blur-sm">
              <Activity size={34} />
            </span>
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-brand-fuchsia/20 bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-fuchsia shadow-sm backdrop-blur-sm">
              Coming soon
            </span>
          </div>
          <div className="flex flex-1 flex-col px-6 py-5">
            <h2 className="font-display text-lg font-semibold text-slate-900">Recent Conversions</h2>
            <p className="mt-1 text-sm text-slate-500">
              A live feed of your latest conversions is on the way. Track approvals, payouts, and chargebacks as they happen.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400">
              <Clock size={15} /> Available soon
            </span>
          </div>
        </div>

        {/* Top Offers — disabled; needs the (not-yet-shipped) API key feature. */}
        <div className={`${CARD} flex min-h-[300px] cursor-not-allowed select-none flex-col opacity-90`} aria-disabled="true">
          <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-amber-200/30 via-amber-100/30 to-slate-50">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
            <div className="pointer-events-none absolute left-8 top-6 h-2 w-2 rounded-full bg-amber-400/50" />
            <div className="pointer-events-none absolute bottom-8 right-10 h-1.5 w-1.5 rounded-full bg-amber-500/40" />
            <span className="grid h-20 w-20 place-items-center rounded-3xl bg-white/70 text-amber-500 shadow-sm ring-1 ring-amber-200/70 backdrop-blur-sm">
              <KeyRound size={34} />
            </span>
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 shadow-sm backdrop-blur-sm">
              API key required
            </span>
          </div>
          <div className="flex flex-1 flex-col px-6 py-5">
            <h2 className="font-display text-lg font-semibold text-slate-900">Top Offers</h2>
            <p className="mt-1 text-sm text-slate-500">
              Unlock your best-performing offers by ranked revenue. Add an API key to fetch offers programmatically.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400">
              <Clock size={15} /> Available soon
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}

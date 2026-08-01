import { memo } from 'react'
import {
  Area,
  AreaChart as ReAreaChart,
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Point = { label: string; value: number; clicks?: number; conversions?: number; users?: number; impressions?: number }

/** Per-series visibility — lets callers add metric filter chips. */
export type SeriesVisibility = { value?: boolean; clicks?: boolean; conversions?: boolean; users?: boolean }

/** Chart style the Reports "Settings" panel can switch between. */
export type ChartKind = 'area' | 'line' | 'bar'

type AreaChartProps = {
  data: Point[]
  height?: number
  visible?: SeriesVisibility
  type?: ChartKind
  smooth?: boolean
}

const REVENUE_COLOR = '#d946ef'
const CLICKS_COLOR = '#10b981'
const CONVERSIONS_COLOR = '#f59e0b'
const USERS_COLOR = '#3b82f6'

function formatUSD(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Compact axis label without rounding tiny values into repeated $0 / $1 ticks.
function axisUSD(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  if (n < 10 && !Number.isInteger(n)) return `$${n.toFixed(2)}`
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

/** Shape recharts passes to custom tooltip content. */
type ChartItem = {
  dataKey?: string | number
  name?: string | number
  value?: string | number
  color?: string
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: ChartItem[]; label?: string | number }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/95 px-3 py-2 text-white shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-xs font-bold text-slate-300">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <p key={String(item.dataKey)} className="flex items-center justify-between gap-4 text-xs font-semibold">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="tabular-nums">
              {item.dataKey === 'value' ? formatUSD(Number(item.value ?? 0)) : Number(item.value ?? 0).toLocaleString()}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}

/**
 * Performance chart. Revenue is plotted in dollars on the left axis; clicks,
 * conversions, and users (raw counts) share a right axis so they stay legible
 * next to much larger revenue numbers. Each visible series can be toggled via
 * `visible`, and the style switches between area / line / bar via `type`
 * (the Reports "Settings" panel drives this).
 */
export const AreaChart = memo(function AreaChart({ data, height = 280, visible, type = 'area', smooth = true }: AreaChartProps) {
  const hasClicks = data.some((point) => point.clicks !== undefined)
  const hasConversions = data.some((point) => point.conversions !== undefined)
  const hasUsers = data.some((point) => point.users !== undefined)

  const showValue = visible?.value ?? true
  const showClicks = (visible?.clicks ?? true) && hasClicks
  const showConversions = (visible?.conversions ?? true) && hasConversions
  const showUsers = (visible?.users ?? true) && hasUsers
  const showCountAxis = showClicks || showConversions || showUsers

  const maxRevenue = data.reduce((m, p) => Math.max(m, Number(p.value ?? 0)), 0)
  const maxCount = data.reduce(
    (m, p) => Math.max(m, Number(p.clicks ?? 0), Number(p.conversions ?? 0), Number(p.users ?? 0)),
    0,
  )
  // Small count data: show integer ticks (0,1,2,…) instead of just "0".
  const countTop = Math.max(1, Math.ceil(maxCount))
  const countTicks = maxCount <= 5 ? Array.from({ length: countTop + 1 }, (_, i) => i) : undefined

  const curve: 'monotone' | 'linear' = smooth ? 'monotone' : 'linear'
  const Container = type === 'line' ? ReLineChart : type === 'bar' ? ReBarChart : ReAreaChart

  type SeriesCfg = {
    dataKey: 'value' | 'clicks' | 'conversions' | 'users'
    yAxisId: 'money' | 'count'
    name: string
    color: string
    fillId: string
    strokeWidth: number
  }
  // Renders one metric in the active chart style (area fill / line / bar).
  const renderSeries = ({ dataKey, yAxisId, name, color, fillId, strokeWidth }: SeriesCfg) => {
    const activeDot = { r: dataKey === 'value' ? 5 : 4, fill: color, stroke: '#fff', strokeWidth: 2 }
    if (type === 'bar') {
      return <Bar key={dataKey} yAxisId={yAxisId} name={name} dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} />
    }
    if (type === 'line') {
      return (
        <Line key={dataKey} yAxisId={yAxisId} name={name} type={curve} dataKey={dataKey} stroke={color} strokeWidth={strokeWidth} dot={false} activeDot={activeDot} />
      )
    }
    return (
      <Area key={dataKey} yAxisId={yAxisId} name={name} type={curve} dataKey={dataKey} stroke={color} strokeWidth={strokeWidth} fill={`url(#${fillId})`} dot={false} activeDot={activeDot} />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Container data={data} margin={{ top: 8, right: showCountAxis ? 8 : 14, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={REVENUE_COLOR} stopOpacity={0.24} />
            <stop offset="100%" stopColor={REVENUE_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillClicks" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CLICKS_COLOR} stopOpacity={0.16} />
            <stop offset="100%" stopColor={CLICKS_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillConversions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CONVERSIONS_COLOR} stopOpacity={0.16} />
            <stop offset="100%" stopColor={CONVERSIONS_COLOR} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={USERS_COLOR} stopOpacity={0.16} />
            <stop offset="100%" stopColor={USERS_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="#0f172a" strokeOpacity={0.06} vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          minTickGap={24}
          dy={8}
        />

        {/* Left axis: revenue in dollars. */}
        <YAxis
          yAxisId="money"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          width={56}
          domain={maxRevenue <= 0 ? [0, 1] : [0, 'auto']}
          tickFormatter={(v) => axisUSD(Number(v))}
        />
        {/* Right axis: click / conversion / user counts (only when shown). */}
        {showCountAxis && (
          <YAxis
            yAxisId="count"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            width={40}
            domain={maxCount <= 0 ? [0, 1] : [0, 'auto']}
            ticks={countTicks}
            allowDecimals={false}
            tickFormatter={(v) => Math.round(Number(v)).toLocaleString()}
          />
        )}

        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#111827', strokeOpacity: 0.28, strokeWidth: 2 }} />

        {showClicks && renderSeries({ dataKey: 'clicks', yAxisId: 'count', name: 'Clicks', color: CLICKS_COLOR, fillId: 'fillClicks', strokeWidth: 2 })}
        {showConversions && renderSeries({ dataKey: 'conversions', yAxisId: 'count', name: 'Conversions', color: CONVERSIONS_COLOR, fillId: 'fillConversions', strokeWidth: 2 })}
        {showUsers && renderSeries({ dataKey: 'users', yAxisId: 'count', name: 'Users', color: USERS_COLOR, fillId: 'fillUsers', strokeWidth: 2 })}
        {showValue && renderSeries({ dataKey: 'value', yAxisId: 'money', name: 'Revenue', color: REVENUE_COLOR, fillId: 'fillRevenue', strokeWidth: 2.5 })}
      </Container>
    </ResponsiveContainer>
  )
})

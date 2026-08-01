import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search, Share, type LucideIcon as Icon } from 'lucide-react'

import LazyAreaChart from './lazy/LazyAreaChart'

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'
const RANGES = ['7d', '14d', '30d'] as const

export type ReportStat = { label: string; value: string; icon: Icon }
export type ReportColumn<T> = {
  header: string
  span: number
  align?: 'right'
  render: (row: T) => ReactNode
}
export type ReportChart = { label: string; data: { label: string; value: number }[] }

type Props<T> = {
  title: string
  description: string
  stats: ReportStat[]
  chart?: ReportChart
  columns: ReportColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  searchPlaceholder?: string
  matchesSearch?: (row: T, q: string) => boolean
  statuses?: readonly string[]
  getStatus?: (row: T) => string
}

export default function ReportTable<T>({
  title,
  description,
  stats,
  chart,
  columns,
  rows,
  rowKey,
  searchPlaceholder = 'Search...',
  matchesSearch,
  statuses,
  getStatus,
}: Props<T>) {
  const [range, setRange] = useState<(typeof RANGES)[number]>('7d')
  const [status, setStatus] = useState<string>(statuses?.[0] ?? 'All')
  const [query, setQuery] = useState('')
  // Draft filters only take effect when the user clicks Apply (or presses Enter).
  const [appliedStatus, setAppliedStatus] = useState<string>(statuses?.[0] ?? 'All')
  const [appliedQuery, setAppliedQuery] = useState('')
  const applyFilters = () => {
    setAppliedStatus(status)
    setAppliedQuery(query)
  }
  const dirty = status !== appliedStatus || query !== appliedQuery

  const filtered = rows.filter((row) => {
    if (statuses && getStatus && appliedStatus !== statuses[0] && getStatus(row) !== appliedStatus) return false
    if (appliedQuery.trim() && matchesSearch && !matchesSearch(row, appliedQuery.trim().toLowerCase())) return false
    return true
  })

  const cell = (span: number, align?: 'right') => ({
    style: { gridColumn: `span ${span} / span ${span}` },
    className: `flex min-w-0 items-center ${align === 'right' ? 'justify-end text-right' : ''}`,
  })

  const mobileStatusColumn = statuses ? columns[columns.length - 1] : undefined
  const mobileDetailColumns = columns.slice(1, mobileStatusColumn ? -1 : columns.length)

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        to="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to Reports
      </Link>

      <div className="mt-4 mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-slate-500 sm:text-base">{description}</p>
        </div>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto sm:self-start"
        >
          <Share size={18} />
          Share CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className={`${CARD} min-w-0 p-4 sm:p-5`}>
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-fuchsia/10 text-brand-fuchsia sm:h-10 sm:w-10">
              <Icon size={19} />
            </span>
            <p className="mt-3 truncate text-xs font-medium text-slate-500 sm:mt-4 sm:text-sm">{label}</p>
            <p className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {value}
            </p>
          </div>
        ))}
      </div>

      {chart && (
        <div className={`mt-5 ${CARD} p-4 sm:mt-6 sm:p-6`}>
          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-900">{chart.label}</h2>
            <div className="flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1 sm:w-auto">
              {RANGES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRange(option)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                    range === option
                      ? 'bg-white text-brand-fuchsia shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <LazyAreaChart data={chart.data} height={220} />
        </div>
      )}

      {/* Table controls */}
      <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs sm:flex-1">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilters()
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {statuses && (
            <div className="flex w-full overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1 sm:w-auto sm:overflow-visible">
              {statuses.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    status === option
                      ? 'bg-white text-brand-fuchsia shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={applyFilters}
            disabled={!dirty}
            className="w-full rounded-xl bg-brand-fuchsia px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-3 sm:hidden">
        {filtered.map((row) => (
          <article key={rowKey(row)} className={`${CARD} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">{columns[0]?.render(row)}</div>
              {mobileStatusColumn && <div className="shrink-0">{mobileStatusColumn.render(row)}</div>}
            </div>

            {mobileDetailColumns.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 rounded-xl bg-slate-50">
                {mobileDetailColumns.map((column) => (
                  <div key={column.header} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {column.header}
                    </span>
                    <div className="flex min-w-0 max-w-[72%] justify-end overflow-hidden text-right">
                      {column.render(row)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}

        {filtered.length === 0 && (
          <div className={`${CARD} px-4 py-10 text-center text-sm text-slate-400`}>
            No results match your filters.
          </div>
        )}
      </div>

      <div className={`mt-4 hidden ${CARD} overflow-x-auto sm:block`}>
        <div className="min-w-[680px]">
          <div className="grid grid-cols-12 gap-4 border-b border-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {columns.map((column) => (
              <div key={column.header} {...cell(column.span, column.align)}>
                {column.header}
              </div>
            ))}
          </div>

          {filtered.map((row) => (
            <div
              key={rowKey(row)}
              className="grid grid-cols-12 items-center gap-4 border-b border-slate-100 px-6 py-4 last:border-0"
            >
              {columns.map((column, index) => (
                <div key={index} {...cell(column.span, column.align)}>
                  {column.render(row)}
                </div>
              ))}
            </div>
          ))}

          {filtered.length === 0 && (
            <p className="px-6 py-12 text-center text-sm text-slate-400">No results match your filters.</p>
          )}
        </div>
      </div>
    </div>
  )
}

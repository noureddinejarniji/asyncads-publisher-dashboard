import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { createPortal } from 'react-dom'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const POPOVER_WIDTH = 288

const pad = (n: number) => String(n).padStart(2, '0')
const toValue = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

/**
 * Custom time unit selector (hour or minute). A styled trigger opens a compact
 * scrollable list — disabled (past) values are greyed and unclickable, and the
 * list auto-scrolls to the current value. Rendered inside the date popover.
 */
function TimeDropdown({
  value,
  options,
  onSelect,
  isOptionDisabled,
  ariaLabel,
}: {
  value: number
  options: number[]
  onSelect: (n: number) => void
  isOptionDisabled?: (n: number) => boolean
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Scroll the current value into view (within the list only) when opening.
  useEffect(() => {
    if (!open || !listRef.current) return
    const sel = listRef.current.querySelector<HTMLElement>('[data-selected="true"]')
    if (sel) listRef.current.scrollTop = sel.offsetTop - listRef.current.clientHeight / 2 + sel.clientHeight / 2
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex w-16 items-center justify-between gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-2.5 pr-1.5 text-sm font-semibold tabular-nums text-slate-900 transition-colors hover:bg-white focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
      >
        {pad(value)}
        <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute bottom-full left-0 z-10 mb-1.5 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {options.map((o) => {
            const disabled = isOptionDisabled?.(o) ?? false
            const selected = o === value
            return (
              <button
                key={o}
                type="button"
                data-selected={selected}
                disabled={disabled}
                onClick={() => {
                  onSelect(o)
                  setOpen(false)
                }}
                className={`block w-full px-2.5 py-1.5 text-center text-sm tabular-nums transition-colors ${
                  selected
                    ? 'bg-brand-fuchsia font-semibold text-white'
                    : disabled
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {pad(o)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type PickerOption = { value: number; label: string; disabled?: boolean }

function PickerDropdown({
  value,
  options,
  onSelect,
  ariaLabel,
  className = '',
}: {
  value: number
  options: PickerOption[]
  onSelect: (n: number) => void
  ariaLabel: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const sel = listRef.current.querySelector<HTMLElement>('[data-selected="true"]')
    if (sel) listRef.current.scrollTop = sel.offsetTop - listRef.current.clientHeight / 2 + sel.clientHeight / 2
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-white focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {options.map((o) => {
            const selectedOption = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                data-selected={selectedOption}
                disabled={o.disabled}
                onClick={() => {
                  onSelect(o.value)
                  setOpen(false)
                }}
                className={`block w-full px-2.5 py-1.5 text-left text-xs transition-colors ${
                  selectedOption
                    ? 'bg-brand-fuchsia font-semibold text-white'
                    : o.disabled
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type Props = { value: string; onChange: (v: string) => void; placeholder?: string; min?: string; max?: string }

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Styled date + time picker. The dropdown is portaled so it escapes modal overflow. */
export default function DateTimePicker({ value, onChange, placeholder = 'Select date & time', min, max }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const selected = value ? new Date(value) : null
  const [view, setView] = useState<Date>(selected ?? new Date())

  // Optional bounds: days/times outside them are disabled, and emitted values clamp into range.
  const minParsed = min ? new Date(min) : null
  const minTime = minParsed && !Number.isNaN(minParsed.getTime()) ? minParsed : null
  const minDay = minTime ? startOfDay(minTime) : null
  const maxParsed = max ? new Date(max) : null
  const maxTime = maxParsed && !Number.isNaN(maxParsed.getTime()) ? maxParsed : null
  const maxDay = maxTime ? startOfDay(maxTime) : null
  const clamp = (d: Date) => {
    if (minTime && d.getTime() < minTime.getTime()) return new Date(minTime)
    if (maxTime && d.getTime() > maxTime.getTime()) return new Date(maxTime)
    return d
  }

  const reposition = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const height = popRef.current?.offsetHeight ?? 340
    const left = Math.min(Math.max(8, r.left), window.innerWidth - POPOVER_WIDTH - 8)
    // Open downward, but flip above the field if it would overflow the viewport.
    const fitsBelow = r.bottom + 4 + height + 8 <= window.innerHeight
    const top = fitsBelow ? r.bottom + 4 : Math.max(8, r.top - height - 4)
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (!open) return
    reposition()
    const onScroll = () => reposition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const year = view.getFullYear()
  const month = view.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const currentYear = new Date().getFullYear()
  const minYear = minDay?.getFullYear()
  const maxYear = maxDay?.getFullYear()
  const yearStart = minYear ?? Math.min(year, currentYear) - 10
  const yearEnd = maxYear ?? Math.max(year, currentYear) + 5
  const yearOptions = Array.from({ length: yearEnd - yearStart + 1 }, (_, i) => {
    const optionYear = yearStart + i
    return {
      value: optionYear,
      label: String(optionYear),
      disabled: (minYear !== undefined && optionYear < minYear) || (maxYear !== undefined && optionYear > maxYear),
    }
  })
  const monthOptions = MONTHS.map((label, value) => ({
    value,
    label: label.slice(0, 3),
    disabled:
      (minDay ? new Date(year, value + 1, 0).getTime() < minDay.getTime() : false) ||
      (maxDay ? new Date(year, value, 1).getTime() > maxDay.getTime() : false),
  }))

  const fallbackTime = minTime ?? new Date()
  const h = selected ? selected.getHours() : fallbackTime.getHours()
  const m = selected ? selected.getMinutes() : fallbackTime.getMinutes()

  const pickDay = (day: number) => onChange(toValue(clamp(new Date(year, month, day, h, m))))
  const setViewMonth = (nextMonth: number) => setView(new Date(year, nextMonth, 1))
  const setViewYear = (nextYear: number) => {
    let nextMonth = minDay && nextYear === minDay.getFullYear() && month < minDay.getMonth() ? minDay.getMonth() : month
    if (maxDay && nextYear === maxDay.getFullYear() && nextMonth > maxDay.getMonth()) {
      nextMonth = maxDay.getMonth()
    }
    setView(new Date(nextYear, nextMonth, 1))
  }
  const setTime = (hour: number, minute: number) => {
    const base = selected ?? new Date(year, month, 1, h, m)
    const d = new Date(base)
    d.setHours(hour)
    d.setMinutes(minute)
    onChange(toValue(clamp(d)))
  }

  const dayDisabled = (day: number) => {
    const d = startOfDay(new Date(year, month, day))
    return Boolean((minDay && d.getTime() < minDay.getTime()) || (maxDay && d.getTime() > maxDay.getTime()))
  }
  const prevMonthDisabled = minDay
    ? new Date(year, month, 0).getTime() < minDay.getTime()
    : false
  const nextMonthDisabled = maxDay ? new Date(year, month + 1, 1).getTime() > maxDay.getTime() : false
  const selectedIsMinDay = Boolean(selected && minDay && startOfDay(selected).getTime() === minDay.getTime())
  const selectedIsMaxDay = Boolean(selected && maxDay && startOfDay(selected).getTime() === maxDay.getTime())
  // On a bound day, times outside the allowed range are disabled.
  const hourDisabled = (hr: number) =>
    Boolean((selectedIsMinDay && minTime && hr < minTime.getHours()) || (selectedIsMaxDay && maxTime && hr > maxTime.getHours()))
  const minuteDisabled = (mn: number) =>
    Boolean(
      (selectedIsMinDay && minTime && h === minTime.getHours() && mn < minTime.getMinutes()) ||
        (selectedIsMaxDay && maxTime && h === maxTime.getHours() && mn > maxTime.getMinutes()),
    )

  const isSelectedDay = (day: number) =>
    selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === day

  const display = selected
    ? selected.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : placeholder

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm transition-colors hover:bg-white focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>{display}</span>
        <Calendar size={17} className="shrink-0 text-slate-400" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
            className="z-[60] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
          >
            {/* Month nav */}
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => !prevMonthDisabled && setView(new Date(year, month - 1, 1))}
                disabled={prevMonthDisabled}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={15} />
              </button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                <PickerDropdown ariaLabel="Month" value={month} options={monthOptions} onSelect={setViewMonth} className="w-28" />
                <PickerDropdown ariaLabel="Year" value={year} options={yearOptions} onSelect={setViewYear} className="w-20" />
              </div>
              <button
                type="button"
                onClick={() => !nextMonthDisabled && setView(new Date(year, month + 1, 1))}
                disabled={nextMonthDisabled}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                <button
                  key={day}
                  type="button"
                  disabled={dayDisabled(day)}
                  onClick={() => pickDay(day)}
                  className={`grid h-8 place-items-center rounded-lg text-sm transition-colors ${
                    isSelectedDay(day)
                      ? 'bg-brand-fuchsia font-semibold text-white'
                      : dayDisabled(day)
                        ? 'cursor-not-allowed text-slate-300'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Time */}
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <Clock size={16} className="shrink-0 text-slate-400" />
              <TimeDropdown ariaLabel="Hour" value={h} options={HOURS} onSelect={(hour) => setTime(hour, m)} isOptionDisabled={hourDisabled} />
              <span className="font-semibold text-slate-400">:</span>
              <TimeDropdown ariaLabel="Minute" value={m} options={MINUTES} onSelect={(minute) => setTime(h, minute)} isOptionDisabled={minuteDisabled} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto rounded-lg bg-brand-fuchsia px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-fuchsia/90"
              >
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Check, Columns3, RotateCcw } from 'lucide-react'

export type ColumnOption = { id: string; label: string; locked?: boolean }

type Props = {
  /** All toggleable columns, in display order. */
  columns: ColumnOption[]
  /** Currently-visible column ids. */
  visible: string[]
  /** Called with the next visible set (kept in `columns` order). */
  onChange: (next: string[]) => void
  /** Restore the default column set. */
  onReset: () => void
}

/**
 * A compact popover to show/hide table columns. Mirrors the dashboard's other
 * dropdowns: click-outside / Escape to close, brand-accented controls.
 */
export default function ColumnManager({ columns, visible, onChange, onReset }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visibleSet = new Set(visible)
  const shownCount = columns.reduce((n, c) => (visibleSet.has(c.id) ? n + 1 : n), 0)

  function toggle(id: string) {
    const next = new Set(visibleSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    // Always emit in the registry's column order so the table layout is stable.
    onChange(columns.filter((c) => next.has(c.id)).map((c) => c.id))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 border px-4 text-sm font-semibold transition-colors ${
          open
            ? 'border-brand-fuchsia/30 bg-brand-fuchsia/10 text-brand-fuchsia'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <Columns3 size={16} /> Columns
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-100 px-1 text-xs font-bold text-slate-500">
          {shownCount}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Manage columns</span>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-fuchsia"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto py-1.5">
            {columns.map((c) => {
              const on = visibleSet.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={c.locked}
                  onClick={() => !c.locked && toggle(c.id)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
                      on ? 'border-brand-fuchsia bg-brand-fuchsia text-white' : 'border-slate-300 bg-white text-transparent'
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="truncate">{c.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

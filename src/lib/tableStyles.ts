// Shared class tokens for the dense, sharp-edged data-grid tables used on
// Reports and Overview. Centralised so every table reads the same: solid
// uppercase header, hairline row dividers, zebra striping, brand-tinted hover.

/** Header cell: sticky-friendly opaque background, uppercase label. */
export const GRID_HEAD =
  'whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500'

/** Body cell: hairline bottom border, comfortable dense height. */
export const GRID_CELL = 'whitespace-nowrap border-b border-slate-100 px-4 py-3.5 align-middle'

/** Body row: zebra stripe + neutral hover (matches the apps list rows). */
export const gridRow = (index: number) =>
  `transition-colors hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`

/** Right-edge shadow for a frozen first column in a horizontally-scrolling grid. */
export const FROZEN_SHADOW = 'shadow-[8px_0_12px_-14px_rgba(15,23,42,0.45)]'

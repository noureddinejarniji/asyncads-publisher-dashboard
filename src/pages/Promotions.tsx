import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Megaphone, Pause, Pencil, Play, Plus, Tag, X } from 'lucide-react'

import { apiGet, apiSend } from '../lib/auth'
import { useCachedSection } from '../store/useCachedSection'
import { useAppDispatch } from '../store'
import { invalidateByPrefix } from '../store/cacheSlice'
import { CACHE_TTL } from '../store/cache'
import InlineSpinner from '../components/InlineSpinner'
import PlacementLocked from '../components/PlacementLocked'
import Modal from '../components/Modal'

// UI promotion shape used by the modals/cards, mapped from the API response.
type Promotion = {
  id: string
  name: string
  boost: number
  boostType: 'percent' | 'multiplier'
  appliesTo: string
  message?: string
  bannerImage?: string
  start: string
  end: string
  enabled: boolean
}

type ApiPromotion = {
  id: number
  name: string
  boostType: 'percent' | 'multiplier'
  boostValue: number
  appliesTo: string
  message?: string | null
  bannerImage?: string | null
  startsAt: string
  endsAt: string
  enabled: boolean
}
type PlacementMetaData = { placement: { status: string } }
type PendingActivation = { id: string; current: Promotion }

const LOCKED_STATUSES = ['draft', 'pending_review']

function toUiPromotion(r: ApiPromotion): Promotion {
  return {
    id: String(r.id),
    name: r.name,
    boost: Number(r.boostValue),
    boostType: r.boostType,
    appliesTo: r.appliesTo ?? 'All offers',
    message: r.message ?? undefined,
    bannerImage: r.bannerImage ?? undefined,
    start: r.startsAt,
    end: r.endsAt,
    enabled: r.enabled,
  }
}
import DateTimePicker from '../components/DateTimePicker'

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'
const field =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20'

const CATEGORIES = ['All offers', 'Surveys', 'Games', 'Installs', 'Sign-ups', 'Purchases']

const boostLabel = (p: Promotion) => (p.boostType === 'multiplier' ? `${p.boost}x` : `+${p.boost}%`)

const pad2 = (n: number) => String(n).padStart(2, '0')
const toPickerDateTime = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`

function defaultPromotionWindow() {
  const start = new Date()
  start.setSeconds(0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start: toPickerDateTime(start), end: toPickerDateTime(end) }
}

function statusOf(p: Promotion) {
  if (!p.enabled) return { label: 'Paused', tone: 'bg-slate-100 text-slate-500' }
  const now = Date.now()
  const start = new Date(p.start).getTime()
  const end = new Date(p.end).getTime()
  if (now < start) return { label: 'Scheduled', tone: 'bg-amber-50 text-amber-600' }
  if (now > end) return { label: 'Ended', tone: 'bg-slate-100 text-slate-500' }
  return { label: 'Active', tone: 'bg-emerald-50 text-emerald-600' }
}

/** Compact date like "4 Jun" for the dense row layout. */
function fmtDay(value: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}


/** Styled single-select dropdown (replaces the native select). */
function CategoryDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 transition-colors hover:bg-white focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
      >
        {value}
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                value === c ? 'font-medium text-brand-fuchsia' : 'text-slate-700'
              }`}
            >
              {c}
              {value === c && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PromotionModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Promotion
  onClose: () => void
  onSave: (p: Promotion) => void | Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [appliesTo, setAppliesTo] = useState(initial?.appliesTo ?? CATEGORIES[0])
  const [boost, setBoost] = useState(String(initial?.boost ?? 50))
  const [boostType] = useState<Promotion['boostType']>(initial?.boostType ?? 'percent')
  const [defaults] = useState(defaultPromotionWindow)
  const [start, setStart] = useState(initial?.start ?? defaults.start)
  const [end, setEnd] = useState(initial?.end ?? defaults.end)
  const [submitting, setSubmitting] = useState(false)
  // Captured once when the modal opens — render must stay pure.
  const [openedAt] = useState(() => Date.now())

  // New promotions can't start in the past; an already-running promo keeps its start on edit.
  const startInPast = !initial && start ? new Date(start).getTime() < openedAt - 60_000 : false
  // Lower bound for the pickers — no past dates; the end can't precede the start.
  const nowValue = toPickerDateTime(new Date(openedAt))
  const valid = Boolean(name.trim()) && Boolean(start) && Boolean(end) && new Date(end) > new Date(start) && !startInPast

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    const payload = {
      id: initial?.id ?? `promo_${Date.now().toString(36)}`,
      appliesTo,
      message: initial?.message,
      bannerImage: initial?.bannerImage,
      enabled: initial?.enabled ?? true,
      name: name.trim(),
      boost: Number(boost) || 0,
      boostType,
      start,
      end,
    }
    try {
      await onSave(payload)
      onClose()
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => !submitting && onClose()} />
      <form
        onSubmit={handleSubmit}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{initial ? 'Edit promotion' : 'New promotion'}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend boost" className={`${field} mb-4`} />

        <label className="mb-1.5 block text-sm font-medium text-slate-700">Applies to</label>
        <div className="mb-4">
          <CategoryDropdown value={appliesTo} onChange={setAppliesTo} />
        </div>

        {/* Boost — percent only */}
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Reward boost</label>
        <div className="mb-4">
          <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-colors focus-within:border-brand-fuchsia focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-fuchsia/20">
            <input
              type="number"
              min={1}
              value={boost}
              onChange={(e) => setBoost(e.target.value)}
              className="w-full bg-transparent px-3.5 py-2.5 text-base font-semibold tabular-nums text-slate-900 focus:outline-none"
            />
            <span className="grid shrink-0 place-items-center border-l border-slate-200 px-4 text-sm font-semibold text-slate-500">
              {boostType === 'percent' ? '%' : '×'}
            </span>
          </div>
          {boostType === 'percent' && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[10, 25, 50, 100].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBoost(String(v))}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    Number(boost) === v
                      ? 'border-brand-fuchsia bg-brand-fuchsia/10 text-brand-fuchsia'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  +{v}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Starts</label>
            <DateTimePicker value={start} onChange={setStart} placeholder="Start date & time" min={nowValue} />
            {startInPast && <p className="mt-1.5 text-xs text-red-500">Start date can't be in the past.</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Ends</label>
            <DateTimePicker value={end} onChange={setEnd} placeholder="End date & time" min={start || nowValue} />
            {end && start && new Date(end) <= new Date(start) && (
              <p className="mt-1.5 text-xs text-red-500">End must be after the start.</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || submitting}
            className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <InlineSpinner className="h-4 w-4 text-white" />}
            {submitting ? (initial ? 'Saving...' : 'Creating...') : initial ? 'Save changes' : 'Create promotion'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Simple, reusable confirm dialog built on the shared Modal (Escape + backdrop close). */
function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} panelClassName="max-w-sm">
      <div className="flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-500">
          <AlertTriangle size={20} />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-fuchsia/25 transition-colors hover:bg-brand-fuchsia/90"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export default function Promotions() {
  const { slug = '' } = useParams()
  const dispatch = useAppDispatch()
  const [editing, setEditing] = useState<Promotion | 'new' | null>(null)
  const [pendingActivation, setPendingActivation] = useState<PendingActivation | null>(null)
  // Optimistic enabled state so a Pause/Resume click flips the card instantly.
  const [enabledOverride, setEnabledOverride] = useState<Record<string, boolean>>({})
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const placementMeta = useCachedSection<PlacementMetaData>({
    key: 'placements.detail',
    params: { slug },
    ttl: CACHE_TTL['placements.detail'],
    fetcher: (signal) => apiGet(`/api/placements/${slug}`, { signal }),
  })
  const status = placementMeta.data?.placement.status
  const locked = status ? LOCKED_STATUSES.includes(status) : false

  const list = useCachedSection<{ promotions: ApiPromotion[] }>({
    key: 'placements.promotions',
    params: { slug },
    ttl: CACHE_TTL['placements.promotions'],
    enabled: Boolean(status && !locked),
    fetcher: (signal) => apiGet(`/api/placements/${slug}/promotions`, { signal }),
  })

  if (locked || (list.error && !list.data && /must be accepted/i.test(list.error))) {
    return <PlacementLocked slug={slug} maxWidth="max-w-4xl" />
  }

  const error = placementMeta.error || list.error
  if (error && !list.data && /not found/i.test(error)) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link to="/placements" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to placements
        </Link>
        <p className="mt-8 text-slate-500">Placement not found.</p>
      </div>
    )
  }

  const promotions = (list.data?.promotions ?? [])
    .map(toUiPromotion)
    .map((p) => (p.id in enabledOverride ? { ...p, enabled: enabledOverride[p.id] } : p))
  const loading = placementMeta.isLoading || list.isLoading

  const afterMutation = () => {
    setEnabledOverride({})
    dispatch(invalidateByPrefix('placements.promotions'))
    dispatch(invalidateByPrefix('placements.config'))
    list.refetch()
  }
  const toBody = (p: Promotion) => ({
    name: p.name,
    boostType: p.boostType,
    boostValue: p.boost,
    appliesTo: p.appliesTo,
    bannerImage: p.bannerImage ?? null,
    message: p.message ?? null,
    startsAt: p.start,
    endsAt: p.end,
    enabled: p.enabled,
  })
  const activeConflict = (targetId: string): Promotion | null =>
    promotions.find((p) => p.id !== targetId && p.enabled && statusOf(p).label === 'Active') ?? null

  // Create/edit never prompts — the API enforces a single active promotion by
  // pausing the others. Activation is only confirmed on an explicit Play click.
  const save = async (promo: Promotion) => {
    try {
      if (promo.id.startsWith('promo_')) {
        await apiSend('POST', `/api/placements/${slug}/promotions`, toBody(promo))
      } else {
        await apiSend('PATCH', `/api/placements/${slug}/promotions/${promo.id}`, toBody(promo))
      }
      afterMutation()
    } catch {
      /* surfaced via the section on next load */
    }
  }

  const toggleNow = async (id: string, enabled: boolean) => {
    const next = !enabled
    // Optimistic flip. Enabling is exclusive — pause the others to match the server.
    setEnabledOverride(() => {
      if (!next) return { [id]: false }
      const map: Record<string, boolean> = {}
      for (const p of promotions) map[p.id] = p.id === id
      return map
    })
    try {
      await apiSend('PATCH', `/api/placements/${slug}/promotions/${id}`, { enabled: next })
      // Refresh silently (keeps the list on screen — no loading flicker) and
      // freshen the off-screen config count. Don't invalidate this list.
      dispatch(invalidateByPrefix('placements.promotions'))
      dispatch(invalidateByPrefix('placements.config'))
      await list.refetch()
      setEnabledOverride({})
    } catch {
      // Fall back to server truth on failure.
      setEnabledOverride({})
    }
  }

  const toggle = async (id: string, enabled: boolean) => {
    const next = !enabled
    const conflict = next ? activeConflict(id) : null
    if (conflict) {
      setPendingActivation({ id, current: conflict })
      return
    }
    await toggleNow(id, enabled)
  }

  const confirmActivation = () => {
    const pending = pendingActivation
    setPendingActivation(null)
    if (pending) void toggleNow(pending.id, false)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={`/placements/${slug}/config`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to Configurations
      </Link>

      <div className="mt-4 mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            Promotions
            {(placementMeta.isRefreshing || list.isRefreshing) && <InlineSpinner className="h-4 w-4" />}
          </h1>
          <p className="mt-1 text-slate-500">Run time-bound reward boosts to drive engagement. Only one promotion can run at a time.</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90"
        >
          <Plus size={18} />
          New promotion
        </button>
      </div>

      {loading ? (
        <div className={`${CARD} flex items-center justify-center gap-2 py-20 text-sm text-slate-400`}>
          <InlineSpinner /> Loading promotions
        </div>
      ) : promotions.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center justify-center gap-3 py-20 text-center`}>
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-fuchsia/10 text-brand-fuchsia">
            <Megaphone size={24} />
          </span>
          <p className="font-medium text-slate-900">No promotions yet</p>
          <p className="max-w-sm text-sm text-slate-500">
            Create a promotion to temporarily boost rewards and increase engagement.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          {promotions.map((p) => {
            const status = statusOf(p)
            const dim = !p.enabled || status.label === 'Ended'
            const startMs = new Date(p.start).getTime()
            const endMs = new Date(p.end).getTime()
            const progress =
              status.label === 'Scheduled'
                ? 0
                : status.label === 'Ended'
                  ? 100
                  : endMs > startMs
                    ? Math.min(100, Math.max(0, ((now - startMs) / (endMs - startMs)) * 100))
                    : 0
            const barColor =
              status.label === 'Active'
                ? 'bg-emerald-500'
                : status.label === 'Scheduled'
                  ? 'bg-amber-400'
                  : status.label === 'Ended'
                    ? 'bg-brand-fuchsia/60'
                    : 'bg-slate-400'
            return (
              <div
                key={p.id}
                className="group relative flex items-center gap-4 border-b border-slate-100 px-5 py-5 transition-colors last:border-0 hover:bg-slate-50"
              >
                <span
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-fuchsia/10 text-brand-fuchsia ${
                    dim ? 'opacity-50 grayscale' : ''
                  }`}
                  title={status.label}
                >
                  <Megaphone size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-slate-900">{p.name}</span>
                </div>
                <span className="shrink-0 rounded-md bg-brand-fuchsia/10 px-1.5 py-0.5 text-xs font-bold text-brand-fuchsia">
                  {boostLabel(p)}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.tone}`}>{status.label}</span>
                <span className="hidden shrink-0 items-center gap-1 text-xs text-slate-400 lg:inline-flex">
                  <Tag size={11} /> {p.appliesTo}
                </span>

                <div className="ml-auto flex shrink-0 items-center gap-4">
                  <div className="hidden w-36 sm:block">
                    <div className="mb-1 text-right text-xs text-slate-400">
                      {fmtDay(p.start)} → {fmtDay(p.end)}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" title={`${Math.round(progress)}% elapsed`}>
                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggle(p.id, p.enabled)}
                    aria-label={p.enabled ? 'Pause promotion' : 'Resume promotion'}
                    title={p.enabled ? 'Pause' : 'Resume'}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    {p.enabled ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    aria-label="Edit promotion"
                    title="Edit"
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil size={16} />
                  </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <PromotionModal
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      {pendingActivation && (
        <ConfirmModal
          open
          title="Activate this promotion?"
          confirmLabel="Activate"
          description={
            <>
              <span className="font-semibold text-slate-700">{pendingActivation.current.name}</span> is active now.
              Activating another promotion will pause it.
            </>
          }
          onCancel={() => setPendingActivation(null)}
          onConfirm={confirmActivation}
        />
      )}
    </div>
  )
}

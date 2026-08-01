import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  MousePointerClick,
  Pencil,
  Percent,
  Send,
  SlidersHorizontal,
  type LucideIcon as Icon,
} from 'lucide-react'

import { apiGet, apiSend } from '../lib/auth'
import { useCachedSection } from '../store/useCachedSection'
import { useAppDispatch } from '../store'
import { invalidateByPrefix } from '../store/cacheSlice'
import { CACHE_TTL } from '../store/cache'
import LazyAreaChart from '../components/lazy/LazyAreaChart'
import BrandIcon from '../components/BrandIcon'
import InlineSpinner from '../components/InlineSpinner'
import Modal from '../components/Modal'
import { PlacementModal } from './Placements'
import pendingPlacementArt from '../assets/empty/pending-placement.png'

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'
const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' }
const LOCKED_STATUSES = ['draft', 'pending_review']

type Placement = {
  slug: string
  publicId: string
  name: string
  platform: string
  domain: string | null
  iconUrl: string | null
  status: string
}

type PlacementMetaData = { placement: Placement }

type OverviewData = {
  placement: Placement
  stats: { clicks: number; conversions: number; revenue: number }
  series: { date: string; value: number | string; clicks: number | string; conversions: number | string }[]
}

function dayLabel(key: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(`${key}T00:00:00Z`))
}

function getStatusDetails(status: string) {
  switch (status) {
    case 'live':
      return { label: 'Live', color: 'bg-emerald-500' }
    case 'pending_review':
      return { label: 'Pending', color: 'bg-amber-500' }
    case 'draft':
      return { label: 'Draft', color: 'bg-slate-300' }
    case 'archived':
      return { label: 'Archived', color: 'bg-slate-300' }
    case 'paused':
    default:
      return { label: 'Paused', color: 'bg-slate-300' }
  }
}

export default function PlacementDetail() {
  const { slug = '' } = useParams()
  const dispatch = useAppDispatch()
  const [editing, setEditing] = useState(false)
  const [confirmingSubmit, setConfirmingSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')

  const placementMeta = useCachedSection<PlacementMetaData>({
    key: 'placements.detail',
    params: { slug },
    ttl: CACHE_TTL['placements.detail'],
    fetcher: (signal) => apiGet(`/api/placements/${slug}`, { signal }),
  })

  const placement = placementMeta.data?.placement
  const isLocked = placement ? LOCKED_STATUSES.includes(placement.status) : false

  const overview = useCachedSection<OverviewData>({
    key: 'placements.overview',
    params: { slug, chart: 'real-series-v1' },
    ttl: CACHE_TTL['placements.overview'],
    enabled: Boolean(placement && !isLocked),
    fetcher: (signal) => apiGet(`/api/placements/${slug}/overview?days=14`, { signal }),
  })

  const stats = overview.data?.stats
  const chartData = (overview.data?.series ?? []).map((point) => ({
    label: dayLabel(point.date),
    value: Number(point.value),
    clicks: Number(point.clicks),
    conversions: Number(point.conversions),
  }))

  async function submitForReview() {
    setSubmitting(true)
    setActionError('')
    try {
      await apiSend('POST', `/api/placements/${slug}/submit`)
      dispatch(invalidateByPrefix('placements.'))
      placementMeta.refetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not submit for review.')
    } finally {
      setSubmitting(false)
      setConfirmingSubmit(false)
    }
  }

  if (placementMeta.error && !placement && /not found/i.test(placementMeta.error)) {
    return (
      <div className="mx-auto max-w-7xl">
        <Link to="/placements" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to placements
        </Link>
        <p className="mt-8 text-slate-500">Placement not found.</p>
      </div>
    )
  }

  const cr = stats && stats.clicks ? (stats.conversions / stats.clicks) * 100 : 0
  const STAT_TILE: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    fuchsia: 'bg-brand-fuchsia/10 text-brand-fuchsia',
  }
  const statCards: { label: string; value: string; icon: Icon; tone: string }[] = stats
    ? [
        { label: 'Clicks', value: stats.clicks.toLocaleString(), icon: MousePointerClick, tone: 'blue' },
        { label: 'Conversions', value: stats.conversions.toLocaleString(), icon: CheckCircle2, tone: 'emerald' },
        { label: 'Conversion rate', value: `${cr.toFixed(1)}%`, icon: Percent, tone: 'violet' },
        { label: 'Revenue', value: `$${stats.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, icon: DollarSign, tone: 'fuchsia' },
      ]
    : [
        { label: 'Clicks', value: '', icon: MousePointerClick, tone: 'blue' },
        { label: 'Conversions', value: '', icon: CheckCircle2, tone: 'emerald' },
        { label: 'Conversion rate', value: '', icon: Percent, tone: 'violet' },
        { label: 'Revenue', value: '', icon: DollarSign, tone: 'fuchsia' },
      ]

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        to="/placements"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to placements
      </Link>

      <div className="mt-4 mb-8 flex items-center gap-4">
        <BrandIcon
          name={placement?.name ?? slug}
          domain={placement?.domain ?? ''}
          platform={placement ? PLATFORM_LABEL[placement.platform] ?? placement.platform : undefined}
          iconUrl={placement?.iconUrl ?? undefined}
          size={52}
        />
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate font-display text-3xl font-bold tracking-tight text-slate-900">
            {placement?.name ?? slug}
            {(placementMeta.isRefreshing || overview.isRefreshing) && <InlineSpinner className="h-4 w-4" />}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            {placement ? (
              <>
                <span className={`h-2 w-2 rounded-full ${getStatusDetails(placement.status).color}`} />
                {PLATFORM_LABEL[placement.platform] ?? placement.platform} - {getStatusDetails(placement.status).label}
              </>
            ) : (
              <InlineSpinner className="h-3.5 w-3.5" />
            )}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {placement?.status === 'draft' && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <Pencil size={17} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmingSubmit(true)}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90 disabled:opacity-50"
              >
                {submitting ? <InlineSpinner className="h-4 w-4 text-white" /> : <Send size={17} />}
                Submit for review
              </button>
            </>
          )}

          {placement?.status === 'pending_review' && (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Pending review
            </span>
          )}

          {placement && !isLocked && (
            <Link
              to={`/placements/${slug}/config`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <SlidersHorizontal size={18} />
              Configure
            </Link>
          )}
        </div>
      </div>

      {actionError && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</p>
      )}

      {placement && isLocked ? (
        <div className={`${CARD} p-8 text-center`}>
          <img
            src={pendingPlacementArt}
            alt=""
            aria-hidden="true"
            className="mx-auto mb-3 h-auto w-full max-w-[300px] object-contain"
          />
          <span className={`mx-auto block h-2 w-2 rounded-full ${getStatusDetails(placement.status).color}`} />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">
            {placement.status === 'draft' ? 'Draft placement' : 'Pending review'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            {placement.status === 'draft'
              ? 'Analytics and configuration data stay hidden until this placement is submitted and accepted.'
              : 'Analytics and configuration data will appear once this placement is accepted.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className={`${CARD} p-5`}>
                <span className={`grid h-10 w-10 place-items-center rounded-xl ${STAT_TILE[tone]}`}>
                  <Icon size={20} />
                </span>
                <p className="mt-4 text-sm text-slate-500">{label}</p>
                <p className="mt-1 font-display text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                  {value || <InlineSpinner className="my-1" />}
                </p>
              </div>
            ))}
          </div>

          <div className={`mt-6 ${CARD} p-6`}>
            <h2 className="mb-1 font-semibold text-slate-900">Performance</h2>
            <p className="mb-6 text-sm text-slate-400">Last 14 days</p>
            {!stats ? (
              <div className="flex h-56 items-center justify-center text-sm text-slate-400">
                <InlineSpinner className="mr-2" /> Loading performance
              </div>
            ) : chartData.length ? (
              <LazyAreaChart data={chartData} />
            ) : (
              <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-sm text-slate-400">
                <img
                  src={pendingPlacementArt}
                  alt=""
                  aria-hidden="true"
                  className="mb-2 h-auto w-full max-w-[180px] object-contain opacity-90"
                />
                <span>No data yet - analytics will appear once this placement starts earning.</span>
              </div>
            )}
          </div>
        </>
      )}

      {editing && placement && (
        <PlacementModal
          mode="edit"
          slug={slug}
          initial={{
            name: placement.name,
            domain: placement.domain,
            platform: placement.platform,
            iconUrl: placement.iconUrl,
          }}
          onClose={() => setEditing(false)}
          onSaved={() => {
            dispatch(invalidateByPrefix('placements.'))
            placementMeta.refetch()
          }}
        />
      )}

      <Modal
        open={confirmingSubmit}
        onClose={() => !submitting && setConfirmingSubmit(false)}
        title="Submit for review?"
        panelClassName="max-w-md"
      >
        <p className="text-sm leading-6 text-slate-500">
          Our team will review this placement before it goes live. You won't be able to edit it while the review is
          pending.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmingSubmit(false)}
            disabled={submitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submitForReview}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90 disabled:opacity-50"
          >
            {submitting ? <InlineSpinner className="h-4 w-4 text-white" /> : <Send size={16} />}
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, ChevronLeft, ChevronRight, LoaderCircle, Lock, RotateCcw, Search } from 'lucide-react'

import { apiGet, apiSend } from '../lib/auth'
import { useCachedSection } from '../store/useCachedSection'
import { useAppDispatch } from '../store'
import { fetchSuccess, invalidateByPrefix } from '../store/cacheSlice'
import { CACHE_TTL, cacheKeyFor } from '../store/cache'
import BrandIcon from '../components/BrandIcon'
import InlineSpinner from '../components/InlineSpinner'
import PlacementLocked from '../components/PlacementLocked'
import { useDebouncedValue } from '../lib/useDebouncedValue'

type ApiOffer = {
  slug: string
  name: string
  iconUrl: string | null
  category: string
  categorySlug: string
  requiresApproval: boolean
  state: 'active' | 'blocked' | 'approval_pending' | 'approved' | 'rejected'
}

type UiState = 'active' | 'blocked' | 'approval' | 'pending'
type PlacementMetaData = { placement: { status: string } }
type OffersResponse = {
  offers: ApiOffer[]
  page: number
  perPage: number
  total: number
  totalPages: number
  counts: { total: number; blocked: number; pending: number }
}

const LOCKED_STATUSES = ['draft', 'pending_review']
const OFFERS_CACHE_SHAPE = 'offer-status-v3'
const OFFERS_PAGE_SIZE = 10

function uiStateOf(o: ApiOffer): UiState {
  if (o.state === 'blocked') return 'blocked'
  if (o.state === 'approval_pending') return 'pending'
  if (o.requiresApproval && o.state !== 'approved') return 'approval'
  return 'active'
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'approval', label: 'Approval' },
] as const

export default function OffersControl() {
  const { slug = '' } = useParams()
  const dispatch = useAppDispatch()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), 350)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'approval'>('all')
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [unblocking, setUnblocking] = useState(false)
  const [page, setPage] = useState(1)

  // Back to page 1 whenever the (debounced) search or status filter changes.
  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, statusFilter])

  const placementMeta = useCachedSection<PlacementMetaData>({
    key: 'placements.detail',
    params: { slug },
    ttl: CACHE_TTL['placements.detail'],
    fetcher: (signal) => apiGet(`/api/placements/${slug}`, { signal }),
  })
  const status = placementMeta.data?.placement.status
  const locked = status ? LOCKED_STATUSES.includes(status) : false

  // Server-side paginated + filtered. Each (page, search, status) combo is its
  // own Redux-cached entry.
  const offersParams = { slug, shape: OFFERS_CACHE_SHAPE, page, q: debouncedQuery, status: statusFilter }
  const list = useCachedSection<OffersResponse>({
    key: 'placements.offers',
    params: offersParams,
    ttl: CACHE_TTL['placements.offers'],
    enabled: Boolean(status && !locked),
    fetcher: (signal) =>
      apiGet(
        `/api/placements/${slug}/offers?` +
          new URLSearchParams({
            page: String(page),
            per_page: String(OFFERS_PAGE_SIZE),
            q: debouncedQuery,
            status: statusFilter,
          }).toString(),
        { signal },
      ),
  })
  const offersCacheKey = cacheKeyFor('placements.offers', offersParams)

  if (locked || (list.error && !list.data && /must be accepted/i.test(list.error))) {
    return <PlacementLocked slug={slug} maxWidth="max-w-3xl" />
  }

  const error = placementMeta.error || list.error
  if (error && !list.data && /not found/i.test(error)) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/placements" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to placements
        </Link>
        <p className="mt-8 text-slate-500">Placement not found.</p>
      </div>
    )
  }

  const data = list.data
  const offers = data?.offers ?? []
  const counts = data?.counts ?? { total: 0, blocked: 0, pending: 0 }
  const totalPages = data?.totalPages ?? 1
  const currentPage = data?.page ?? page
  const loading = placementMeta.isLoading || list.isLoading

  async function setState(offerSlug: string, state: ApiOffer['state']) {
    if (!data) return
    const snapshot = data
    // Optimistic: reflect the new state on the current page immediately.
    dispatch(
      fetchSuccess({
        key: offersCacheKey,
        data: { ...snapshot, offers: snapshot.offers.map((o) => (o.slug === offerSlug ? { ...o, state } : o)) },
      }),
    )
    setBusy((b) => new Set(b).add(offerSlug))
    try {
      await apiSend('PATCH', `/api/placements/${slug}/offers/${offerSlug}`, { state })
      // Refetch authoritative page so server-side filtering + counts reconcile.
      dispatch(invalidateByPrefix('placements.offers'))
      dispatch(invalidateByPrefix('placements.config'))
    } catch {
      dispatch(fetchSuccess({ key: offersCacheKey, data: snapshot }))
    } finally {
      setBusy((b) => {
        const next = new Set(b)
        next.delete(offerSlug)
        return next
      })
    }
  }

  async function unblockAll() {
    setUnblocking(true)
    try {
      await apiSend('POST', `/api/placements/${slug}/offers/unblock-all`, {})
      dispatch(invalidateByPrefix('placements.offers'))
      dispatch(invalidateByPrefix('placements.config'))
    } catch {
      // Leave state as-is; a refresh will show the real state.
    } finally {
      setUnblocking(false)
    }
  }

  const pageStart = (currentPage - 1) * OFFERS_PAGE_SIZE

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/placements/${slug}/config`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Configuration
        </Link>
        {counts.blocked > 0 && (
          <button
            type="button"
            onClick={unblockAll}
            disabled={unblocking}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          >
            {unblocking ? <LoaderCircle size={14} className="animate-spin" /> : <RotateCcw size={14} />}
            Unblock all
          </button>
        )}
      </div>

      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-slate-900">
          Offers Control
          {(placementMeta.isRefreshing || list.isRefreshing) && <InlineSpinner className="h-4 w-4" />}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose which offers appear on your offerwall.{' '}
          <span className="text-slate-400">
            {counts.total} total
            {counts.blocked > 0 && ` - ${counts.blocked} blocked`}
            {counts.pending > 0 && ` - ${counts.pending} pending`}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search offers"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
          />
        </div>
      </div>

      <div className="flex w-full rounded-xl border border-slate-200 bg-slate-50 p-1 sm:w-auto sm:self-start">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`flex-1 rounded-lg px-4 py-1.5 text-xs font-semibold transition-all sm:flex-none ${
              statusFilter === f.key ? 'bg-white text-brand-fuchsia shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-400">
          <InlineSpinner /> Loading offers
        </div>
      ) : offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Search size={22} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No matching offers</p>
          <p className="max-w-xs text-xs text-slate-400">Try adjusting your search, category, or status filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
          {offers.map((o) => {
            const state = uiStateOf(o)
            const isBlocked = state === 'blocked'
            const isBusy = busy.has(o.slug)
            return (
              <div
                key={o.slug}
                className={`flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-slate-50/60 ${
                  isBlocked ? 'opacity-60' : ''
                }`}
              >
                <div className={isBlocked ? 'grayscale' : ''}>
                  <BrandIcon name={o.name} domain="" iconUrl={o.iconUrl ?? undefined} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${isBlocked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    {o.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <span>{o.category}</span>
                    {o.requiresApproval && (
                      <>
                        <span className="text-slate-300">-</span>
                        <span className="inline-flex items-center gap-1">
                          <Lock size={11} /> Approval required
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {state === 'approval' && (
                  <button
                    type="button"
                    onClick={() => setState(o.slug, 'approval_pending')}
                    disabled={isBusy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  >
                    {isBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Lock size={14} />}
                    Request approval
                  </button>
                )}

                {state === 'pending' && (
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600">
                      <Lock size={11} /> Pending
                    </span>
                    <button
                      type="button"
                      onClick={() => setState(o.slug, 'active')}
                      disabled={isBusy}
                      className="text-xs font-semibold text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {(state === 'active' || state === 'blocked') && (
                  <button
                    type="button"
                    onClick={() => setState(o.slug, isBlocked ? 'active' : 'blocked')}
                    disabled={isBusy}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      isBlocked
                        ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                  >
                    {isBusy ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : isBlocked ? (
                      <RotateCcw size={14} />
                    ) : (
                      <Ban size={14} />
                    )}
                    {isBlocked ? 'Unblock' : 'Block'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-500">
            Showing {pageStart + 1}-{pageStart + offers.length} of {data?.total ?? 0}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || list.isRefreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="min-w-16 text-center text-sm font-semibold text-slate-500">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || list.isRefreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

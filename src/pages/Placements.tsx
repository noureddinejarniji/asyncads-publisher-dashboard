import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Copy, DownloadCloud, Eye, LoaderCircle, Plus, Search, Settings, TriangleAlert } from 'lucide-react'

import { apiGet, apiSend, ApiError } from '../lib/auth'
import { fetchSiteTitle, searchApps, type StoreApp } from '../lib/appStores'
import { useAsyncSearch } from '../lib/useAsyncSearch'
import { toast } from '../components/toast'
import BrandIcon from '../components/BrandIcon'
import Modal from '../components/Modal'
import InlineSpinner from '../components/InlineSpinner'
import { useCachedSection } from '../store/useCachedSection'
import { useAppDispatch } from '../store'
import { invalidateByPrefix } from '../store/cacheSlice'
import { CACHE_TTL } from '../store/cache'
import noPlacementsArt from '../assets/empty/no-placements.png'

const PLATFORMS = ['iOS', 'Android', 'Web']
const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'
const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' }

type ListPlacement = {
  slug: string
  publicId: string
  name: string
  platform: string
  domain: string | null
  iconUrl: string | null
  status: string
  postbackEnabled: boolean
  postbackConfigured: boolean
  createdAt: string
}

const pill = (on: boolean, labelOn: string, labelOff: string, offCls = 'bg-slate-100 text-slate-500', offDot = 'bg-slate-400') => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      on ? 'bg-emerald-50 text-emerald-600' : offCls
    }`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-emerald-500' : offDot}`} />
    {on ? labelOn : labelOff}
  </span>
)

// 'YYYY-MM-DD HH:MM:SS' → e.g. "Jun 10, 2026"
const fmtCreated = (s: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(s.replace(' ', 'T')),
  )

function cleanDomain(input: string) {
  return input
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
}

function nameFromDomain(domain: string) {
  const label = domain.split('.')[0]
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : domain
}

function isValidDomain(domain: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)
}

function cleanAppIdentifier(input: string, platform: string) {
  const value = input.trim()
  if (!value) return ''
  if (platform === 'Android') {
    const match = value.match(/[?&]id=([a-z0-9.]+)/i)
    if (match) return match[1].toLowerCase()
  }
  if (platform === 'iOS') {
    const match = value.match(/\/id(\d+)|\bid(\d+)\b/i)
    const id = match?.[1] ?? match?.[2]
    if (id) return `id${id}`
  }
  return value
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .trim()
    .toLowerCase()
}

function isValidAppIdentifier(identifier: string) {
  return identifier === '' || /^[a-z0-9](?:[a-z0-9.-]{0,253}[a-z0-9])?$/i.test(identifier)
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

function platformLabel(platform: string) {
  return PLATFORM_LABEL[platform] ?? (platform === 'iOS' || platform === 'Android' || platform === 'Web' ? platform : 'Web')
}

function AddAppGuide({ platform, mode }: { platform: string; mode: 'create' | 'edit' }) {
  const steps =
    platform === 'Web'
      ? [
          `Choose Web.`,
          `Enter your website domain.`,
          `${mode === 'edit' ? 'Save the changes.' : 'Preview it, then continue setup.'}`,
        ]
      : platform === 'Android'
        ? [
            'Choose Android.',
            'Search your app on Google Play.',
            `${mode === 'edit' ? 'Select it, or create a custom placement if it is not listed.' : 'Select it, or create a custom placement if it is not listed.'}`,
          ]
        : [
            'Choose iOS.',
            'Search your app on the App Store.',
            `${mode === 'edit' ? 'Select it, or create a custom placement if it is not listed.' : 'Select it, or create a custom placement if it is not listed.'}`,
          ]

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{mode === 'edit' ? 'How to edit your app' : 'How to add your app'}</p>
      <div className="mt-3 grid gap-2.5 text-sm text-slate-600">
        {steps.map((step, index) => (
          <div key={step} className="flex gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-fuchsia text-xs font-bold text-white">
              {index + 1}
            </span>
            <span className="leading-5">{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type PlacementModalProps = {
  mode?: 'create' | 'edit'
  slug?: string
  initial?: { name: string; platform: string; domain: string | null; iconUrl: string | null }
  onClose: () => void
  onSaved?: () => void
}

export function PlacementModal({ mode = 'create', slug, initial, onClose, onSaved }: PlacementModalProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const startsCustom = Boolean(initial && initial.platform !== 'web' && !initial.domain && !initial.iconUrl)
  const [open, setOpen] = useState(true)
  const close = () => {
    setOpen(false)
    setTimeout(onClose, 200)
  }
  const [platform, setPlatform] = useState(() => platformLabel(initial?.platform ?? 'iOS'))
  const [selected, setSelected] = useState<StoreApp | null>(() =>
    initial && initial.platform !== 'web' && !startsCustom
      ? {
          id: initial.name,
          name: initial.name,
          domain: initial.domain ?? '',
          icon: initial.iconUrl ?? '',
          developer: '',
        }
      : null,
  )
  const [customOpen, setCustomOpen] = useState(startsCustom)
  const [customName, setCustomName] = useState(() => (initial?.platform !== 'web' ? initial?.name ?? '' : ''))
  const [customIdentifier, setCustomIdentifier] = useState(() =>
    initial?.platform !== 'web' ? initial?.domain ?? '' : '',
  )
  const [connectionOpen, setConnectionOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Imported website title + the domain it was imported for (so a changed domain
  // invalidates it) and an abort handle for the in-flight import.
  const [webTitle, setWebTitle] = useState<string | null>(null)
  const [webTitleDomain, setWebTitleDomain] = useState<string | null>(null)
  const [webTitleLoading, setWebTitleLoading] = useState(false)
  const titleControllerRef = useRef<AbortController | null>(null)

  const isWeb = platform === 'Web'

  // Reusable debounced + abortable + race-safe store search. Disabled for Web,
  // once an app is selected, or while filling in a custom placement — in those
  // states the hook clears its results and never touches the network.
  const { query, setQuery, results, loading, retry, reset: resetSearch } = useAsyncSearch<StoreApp>({
    delay: 400,
    minLength: 2,
    enabled: !isWeb && !selected && !customOpen,
    initialQuery: initial?.platform === 'web' ? initial.domain ?? '' : '',
    fetcher: (term, signal) => {
      if (navigator.onLine === false) return Promise.reject(new Error('offline'))
      return searchApps(platform, term, signal)
    },
    onError: () => setConnectionOpen(true),
  })

  function changePlatform(p: string) {
    setPlatform(p)
    resetSearch()
    setSelected(null)
    setCustomOpen(false)
    setCustomName('')
    setCustomIdentifier('')
  }

  function openCustomPlacement() {
    setSelected(null)
    setCustomName((current) => current || query.trim())
    setCustomOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    let body: { name: string; platform: string; domain: string; iconUrl?: string }
    if (isWeb) {
      const domain = cleanDomain(query)
      if (!isValidDomain(domain)) return
      body = { name: webName, platform: 'web', domain }
    } else if (customOpen) {
      const name = customName.trim()
      const identifier = cleanAppIdentifier(customIdentifier, platform)
      if (!name || !isValidAppIdentifier(identifier)) return
      body = { name, platform: platform.toLowerCase(), domain: identifier }
    } else {
      if (!selected) return
      body = { name: selected.name, platform: platform.toLowerCase(), domain: selected.domain ?? '', iconUrl: selected.icon }
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      if (mode === 'edit' && slug) {
        await apiSend('PATCH', `/api/placements/${slug}`, body)
        dispatch(invalidateByPrefix('placements.'))
        onSaved?.()
        close()
        return
      }

      const { placement } = await apiSend<{ placement: { slug: string; publicId: string } }>('POST', '/api/placements', body)
      dispatch(invalidateByPrefix('placements.'))
      onClose()
      navigate(`/placements/${placement.slug}`)
    } catch (err) {
      // Conflicts (app already added, or a draft/pending placement is still in
      // progress) surface as a toast — we no longer redirect to the existing app.
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message || 'This app already exists.')
        return
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not add the app.')
    } finally {
      setSubmitting(false)
    }
  }

  const field =
    'w-full rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20'
  const cleanedDomain = cleanDomain(query)
  const validWebDomain = isValidDomain(cleanedDomain)
  // The website title is imported on demand (the "Import" button) rather than on
  // every keystroke — explicit, and it keeps the third-party lookup to one call.
  const importedThisDomain = webTitleDomain === cleanedDomain
  const webName = (importedThisDomain && webTitle?.trim()) || nameFromDomain(cleanedDomain)

  async function importWebsite() {
    const domain = cleanDomain(query)
    if (!isValidDomain(domain)) return
    titleControllerRef.current?.abort()
    const controller = new AbortController()
    titleControllerRef.current = controller
    setWebTitleLoading(true)
    try {
      const fetched = await fetchSiteTitle(domain, controller.signal)
      if (controller.signal.aborted) return
      setWebTitle(fetched)
      setWebTitleDomain(domain)
    } catch {
      if (controller.signal.aborted) return
      setWebTitle(null)
      setWebTitleDomain(domain)
    } finally {
      if (!controller.signal.aborted) setWebTitleLoading(false)
    }
  }

  const cleanedIdentifier = cleanAppIdentifier(customIdentifier, platform)
  const validCustomIdentifier = isValidAppIdentifier(cleanedIdentifier)
  const canSubmit = isWeb ? validWebDomain : customOpen ? customName.trim().length > 0 && validCustomIdentifier : !!selected
  const showGuide = !selected && !customOpen && query.trim().length === 0
  const title = mode === 'edit' ? 'Edit app' : 'Add app'

  return (
    <Modal open={open} onClose={close} title={title}>
      <form onSubmit={handleSubmit}>
        {/* Platform */}
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Platform</label>
        <div className="mb-4 flex gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => changePlatform(p)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                platform === p
                  ? 'border-brand-fuchsia bg-brand-fuchsia/10 text-brand-fuchsia'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="min-h-[5.875rem]">
          {isWeb ? (
            <>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Website</label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Yourwebsite.com"
                  className={`${field} flex-1 px-3.5 py-2.5`}
                />
                {validWebDomain && (
                  <button
                    type="button"
                    onClick={importWebsite}
                    disabled={webTitleLoading}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      importedThisDomain
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'border-brand-fuchsia/30 text-brand-fuchsia hover:bg-brand-fuchsia/5'
                    }`}
                  >
                    {webTitleLoading ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : importedThisDomain ? (
                      <Check size={16} />
                    ) : (
                      <DownloadCloud size={16} />
                    )}
                    {webTitleLoading ? 'Importing' : importedThisDomain ? 'Imported' : 'Import'}
                  </button>
                )}
              </div>
              {cleanedDomain && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <BrandIcon name={webName} domain={cleanedDomain} platform="Web" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-900">
                      {webName}
                      {webTitleLoading && <LoaderCircle size={13} className="shrink-0 animate-spin text-slate-400" />}
                    </p>
                    <p className="truncate text-xs text-slate-400">{cleanedDomain}</p>
                  </div>
                </div>
              )}
            </>
          ) : selected ? (
            <>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Selected app</label>
              <div className="flex items-center gap-3 rounded-xl border border-brand-fuchsia/40 bg-brand-fuchsia/5 p-3">
                <BrandIcon name={selected.name} domain={selected.domain ?? ''} iconUrl={selected.icon} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{selected.name}</p>
                  {selected.developer && <p className="truncate text-xs text-slate-400">{selected.developer}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null)
                    setCustomOpen(false)
                  }}
                  className="shrink-0 text-xs font-medium text-brand-fuchsia hover:text-brand-violet"
                >
                  Change
                </button>
              </div>
            </>
          ) : customOpen ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-slate-700">Custom placement</label>
                <button
                  type="button"
                  onClick={() => setCustomOpen(false)}
                  className="text-xs font-semibold text-brand-fuchsia hover:text-brand-violet"
                >
                  Back to search
                </button>
              </div>
              <div className="grid gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    App name
                  </label>
                  <input
                    autoFocus
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={platform === 'iOS' ? 'My iOS app' : 'My Android app'}
                    className={`${field} px-3.5 py-2.5`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    App ID / package optional
                  </label>
                  <input
                    value={customIdentifier}
                    onChange={(e) => setCustomIdentifier(e.target.value)}
                    placeholder={platform === 'iOS' ? 'id123456789' : 'com.company.app'}
                    className={`${field} px-3.5 py-2.5`}
                  />
                  {!validCustomIdentifier && (
                    <p className="mt-2 text-xs font-medium text-red-500">Use letters, numbers, dots, or hyphens.</p>
                  )}
                </div>
              </div>
              {customName.trim() && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <BrandIcon
                    name={customName.trim()}
                    domain={cleanedIdentifier}
                    platform={platform}
                    size={44}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{customName.trim()}</p>
                    <p className="truncate text-xs text-slate-400">
                      {cleanedIdentifier || `${platform} custom placement`}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Find your app on {platform === 'iOS' ? 'the App Store' : 'Google Play'}
              </label>
              <div className="relative">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                {loading && (
                  <LoaderCircle size={17} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                )}
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={platform === 'iOS' ? 'Search the App Store...' : 'Search Google Play...'}
                  className={`${field} py-2.5 pl-9 pr-9`}
                />
              </div>

              {/* Results */}
              <div className="mt-2 max-h-64 overflow-y-auto">
                {results.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelected(app)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <BrandIcon name={app.name} domain={app.domain ?? ''} iconUrl={app.icon} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{app.name}</p>
                      {app.developer && <p className="truncate text-xs text-slate-400">{app.developer}</p>}
                    </div>
                    <Check size={16} className="shrink-0 text-transparent" />
                  </button>
                ))}
                {!loading && query.trim().length >= 2 && results.length > 0 && (
                  <div className="mt-2 border-t border-slate-100 px-2 py-3 text-center">
                    <p className="text-sm text-slate-400">Can't find the right app?</p>
                    <button
                      type="button"
                      onClick={openCustomPlacement}
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-fuchsia hover:text-brand-fuchsia"
                    >
                      <Plus size={16} />
                      Create custom placement
                    </button>
                  </div>
                )}
                {!loading && query.trim().length >= 2 && results.length === 0 && (
                  <div className="px-2 py-4 text-center">
                    <p className="text-sm text-slate-400">No apps found.</p>
                    <button
                      type="button"
                      onClick={openCustomPlacement}
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-fuchsia hover:text-brand-fuchsia"
                    >
                      <Plus size={16} />
                      Create custom placement
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {showGuide && <AddAppGuide platform={platform} mode={mode} />}
        </div>

        {submitError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <InlineSpinner className="h-4 w-4 text-white" />}
            {mode === 'edit' ? 'Save changes' : 'Add app'}
          </button>
        </div>
      </form>
      <Modal open={connectionOpen} onClose={() => setConnectionOpen(false)} title="No connection" panelClassName="max-w-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <TriangleAlert size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">
              App search is unavailable right now. Check your connection, then try again.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConnectionOpen(false)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              setConnectionOpen(false)
              retry()
            }}
            className="rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90"
          >
            Retry
          </button>
        </div>
      </Modal>
    </Modal>
  )
}

export default function Placements() {
  const [creating, setCreating] = useState(false)
  const [copiedPublicId, setCopiedPublicId] = useState<string | null>(null)
  const list = useCachedSection<{ placements: ListPlacement[] }>({
    key: 'placements.list',
    // Shape version — busts caches that predate the postback/created columns.
    params: { shape: 'placement-id-number-v3' },
    ttl: CACHE_TTL['placements.list'],
    fetcher: (signal) => apiGet('/api/placements', { signal }),
  })
  const placements = list.data?.placements ?? []
  // Only one in-progress app at a time: block creating another while an existing
  // placement is still a draft or awaiting review.
  const pendingPlacement = placements.find((p) => p.status === 'draft' || p.status === 'pending_review')
  const createBlocked = Boolean(pendingPlacement)

  async function copyPlacementId(publicId: string) {
    try {
      await navigator.clipboard.writeText(publicId)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = publicId
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopiedPublicId(publicId)
    window.setTimeout(() => {
      setCopiedPublicId((current) => (current === publicId ? null : current))
    }, 1200)
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            Placements
            {list.isRefreshing && <InlineSpinner className="h-4 w-4" />}
          </h1>
          <p className="mt-1 text-slate-500">Manage where your offerwall appears.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          disabled={createBlocked}
          title={createBlocked ? `Finish setting up “${pendingPlacement?.name}” before adding another app.` : undefined}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-fuchsia"
        >
          <Plus size={18} />
          Add app
        </button>
      </div>

      {createBlocked && pendingPlacement && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <TriangleAlert size={16} className="shrink-0" />
          <span>
            Finish setting up{' '}
            <Link to={`/placements/${pendingPlacement.slug}`} className="font-semibold underline underline-offset-2">
              {pendingPlacement.name}
            </Link>{' '}
            ({pendingPlacement.status === 'draft' ? 'draft' : 'pending review'}) before you can add another app.
          </span>
        </div>
      )}

      <div className={CARD}>
        <div className="hidden grid-cols-12 gap-4 border-b border-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:grid">
          <span className="col-span-3">Placement</span>
          <span className="col-span-2">Placement ID</span>
          <span className="col-span-2">Postback</span>
          <span className="col-span-2">Config</span>
          <span className="col-span-2 text-right">Created</span>
          <span className="col-span-1 text-right">Actions</span>
        </div>

        {list.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <InlineSpinner /> Loading placements
          </div>
        ) : list.error && placements.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-slate-500">{list.error}</p>
            <button
              type="button"
              onClick={list.refetch}
              className="rounded-xl bg-brand-fuchsia px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90"
            >
              Retry
            </button>
          </div>
        ) : placements.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <img
              src={noPlacementsArt}
              alt=""
              className="mb-5 h-44 w-auto max-w-full object-contain"
              draggable={false}
            />
            <p className="text-sm font-semibold text-slate-900">No placements yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">Add your first app to start setup.</p>
            <button
              onClick={() => setCreating(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90"
            >
              <Plus size={18} />
              Add app
            </button>
          </div>
        ) : (
          placements.map((p) => {
            const statusDetails = getStatusDetails(p.status)
            const locked = ['draft', 'pending_review'].includes(p.status)
            return (
              <div
                key={p.slug}
                className="grid grid-cols-2 items-center gap-4 border-b border-slate-100 px-6 py-4 transition-colors last:border-0 hover:bg-slate-50 sm:grid-cols-12"
              >
                <Link to={`/placements/${p.slug}`} className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-3">
                  <BrandIcon name={p.name} domain={p.domain ?? ''} platform={PLATFORM_LABEL[p.platform] ?? p.platform} iconUrl={p.iconUrl ?? undefined} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{p.name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDetails.color}`} />
                      {PLATFORM_LABEL[p.platform] ?? p.platform} · {statusDetails.label}
                    </p>
                  </div>
                </Link>
                <div className="hidden min-w-0 items-center gap-2 sm:col-span-2 sm:flex">
                  <span className="block min-w-0 truncate font-mono text-sm font-semibold text-slate-700">
                    {p.publicId}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyPlacementId(p.publicId)}
                    title="Copy placement ID"
                    aria-label={`Copy placement ID ${p.publicId}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-fuchsia"
                  >
                    {copiedPublicId === p.publicId ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                <div className="col-span-1 flex items-center sm:col-span-2">
                  {pill(p.postbackEnabled, 'Enabled', 'Disabled')}
                </div>
                <div className="hidden items-center sm:col-span-2 sm:flex">
                  {pill(p.postbackConfigured, 'Configured', 'Not configured', 'bg-amber-50 text-amber-600', 'bg-amber-500')}
                </div>
                <p className="hidden text-right text-sm text-slate-600 sm:col-span-2 sm:block">
                  {p.createdAt ? fmtCreated(p.createdAt) : '—'}
                </p>
                <div className="col-span-1 flex items-center justify-end gap-1 sm:col-span-1">
                  <Link
                    to={`/placements/${p.slug}`}
                    title="View placement"
                    aria-label="View placement"
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-fuchsia"
                  >
                    <Eye size={18} />
                  </Link>
                  {locked ? (
                    <span
                      title="This placement must be accepted before it can be configured."
                      aria-label="Configure (locked)"
                      className="grid h-8 w-8 cursor-not-allowed place-items-center rounded-lg text-slate-200"
                    >
                      <Settings size={18} />
                    </span>
                  ) : (
                    <Link
                      to={`/placements/${p.slug}/config`}
                      title="Configure"
                      aria-label="Configure"
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-fuchsia"
                    >
                      <Settings size={18} />
                    </Link>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {creating && <PlacementModal onClose={() => setCreating(false)} />}
    </div>
  )
}

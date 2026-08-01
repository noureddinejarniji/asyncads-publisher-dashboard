import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  CheckCircle2,
  ChevronRight,
  Circle,
  ListChecks,
  Megaphone,
  Rocket,
  X,
  type LucideIcon as Icon,
} from 'lucide-react'

import { apiGet } from '../lib/auth'
import { useCachedSection } from '../store/useCachedSection'
import { CACHE_TTL } from '../store/cache'
import InlineSpinner from '../components/InlineSpinner'
import PlacementLocked from '../components/PlacementLocked'

type Step = { stepKey: string; label: string; sortOrder: number; completedAt: string | null }
type DetailData = {
  placement: { name: string }
  postback: { enabled: boolean } | null
  steps: Step[]
  offerControls: { blocked: number; pending: number; approved: number }
  promotionsCount: number
}
type PlacementMetaData = {
  placement: { name: string; status: string }
}

type Tone = 'violet' | 'emerald' | 'fuchsia' | 'rose'
const TONE: Record<Tone, { tile: string; pill: string }> = {
  violet: { tile: 'bg-violet-50 text-violet-600', pill: 'bg-violet-50 text-violet-600' },
  emerald: { tile: 'bg-emerald-50 text-emerald-600', pill: 'bg-emerald-50 text-emerald-600' },
  fuchsia: { tile: 'bg-brand-fuchsia/10 text-brand-fuchsia', pill: 'bg-brand-fuchsia/10 text-brand-fuchsia' },
  rose: { tile: 'bg-rose-50 text-rose-600', pill: 'bg-rose-50 text-rose-600' },
}

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'

/** Animates a number from 0 to `target` once it becomes available. */
function useCountUp(target: number, active: boolean, duration = 900): number {
  const [value, setValue] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setValue(target * eased)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, active, duration])
  return value
}

/** Circular completion gauge shown in the hero banner. */
function ProgressRing({ value, size = 148, stroke = 12 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-white/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="url(#cfgGrad)"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="cfgGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold tracking-tight text-white">{Math.round(value)}%</span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">configured</span>
      </div>
    </div>
  )
}

// What each step is waiting on — shown so publishers know how to complete it.
const STEP_HINTS: Record<string, string> = {
  'create-placement': 'Completed automatically when the placement is created.',
  'configure-postback': 'Completes when your postback is active with a callback URL.',
  'build-endpoint': 'Stand up an endpoint on your server that receives our postback and returns 1.',
  'test-endpoint': 'Completes after a successful test from the S2S Callbacks page.',
  'go-live': 'Completes once the placement is live with at least one click and one conversion.',
}

/** Read-only checklist — steps are detected automatically from real activity. */
function IntegrationStepsModal({ steps, onClose }: { steps: Step[]; onClose: () => void }) {
  const done = steps.filter((s) => s.completedAt).length
  const total = steps.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Integration steps</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-500">
          These track <span className="font-medium text-slate-700">automatically</span> as you integrate — there's
          nothing to check off manually.
        </p>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {done}/{total} steps completed
          </span>
          <span className="text-slate-400">{total ? Math.round((done / total) * 100) : 0}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-violet to-brand-fuchsia transition-all"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>

        <ul className="mt-4 space-y-1">
          {steps.map((step) => {
            const isDone = !!step.completedAt
            return (
              <li key={step.stepKey} className="flex items-start gap-3 rounded-lg px-2 py-2.5">
                {isDone ? (
                  <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle size={22} className="mt-0.5 shrink-0 text-slate-300" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isDone ? 'text-slate-700' : 'text-slate-900'}`}>{step.label}</p>
                  <p className="text-xs text-slate-400">
                    {isDone ? 'Done' : STEP_HINTS[step.stepKey] ?? 'Pending'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

type Section = {
  icon: Icon
  tone: Tone
  title: string
  description: string
  done: boolean
  status: string
  to?: string
  onClick?: () => void
}

function ConfigRow({ section }: { section: Section }) {
  const t = TONE[section.tone]
  const inner = (
    <>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${t.tile}`}>
        <section.icon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              section.done ? t.pill : 'bg-slate-100 text-slate-500'
            }`}
          >
            {section.done ? <CheckCircle2 size={12} /> : <Circle size={12} />}
            {section.status}
          </span>
        </span>
        <span className="mt-0.5 block text-sm leading-5 text-slate-500">{section.description}</span>
      </span>
      <ChevronRight
        size={18}
        className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500"
      />
    </>
  )

  const cls = 'group flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-slate-50'

  return section.to ? (
    <Link to={section.to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={section.onClick} className={cls}>
      {inner}
    </button>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-5">
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-slate-100" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-64 max-w-full animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  )
}

export default function PlacementConfig() {
  const { slug = '' } = useParams()
  const [showSteps, setShowSteps] = useState(false)
  const placementMeta = useCachedSection<PlacementMetaData>({
    key: 'placements.detail',
    params: { slug },
    ttl: CACHE_TTL['placements.detail'],
    fetcher: (signal) => apiGet(`/api/placements/${slug}`, { signal }),
  })
  const status = placementMeta.data?.placement.status
  const locked = status ? ['draft', 'pending_review'].includes(status) : false
  const detail = useCachedSection<DetailData>({
    key: 'placements.config',
    params: { slug, shape: 'postback-live-v2' },
    ttl: CACHE_TTL['placements.config'],
    enabled: Boolean(status && !locked),
    fetcher: (signal) => apiGet(`/api/placements/${slug}/config`, { signal }),
  })
  const didRefreshConfig = useRef(false)

  useEffect(() => {
    if (!status || locked || didRefreshConfig.current) return
    didRefreshConfig.current = true
    detail.refetch()
  }, [detail, locked, status])
  const d = detail.data

  const loading = !d && !locked
  const steps = d?.steps ?? []
  const totalSteps = steps.length || 4
  const stepsDone = steps.filter((s) => s.completedAt).length
  const integrationConfigured = totalSteps > 0 && stepsDone === totalSteps
  const s2sActive = !!d?.postback?.enabled
  const promotionsCount = d?.promotionsCount ?? 0
  const blockedCount = d?.offerControls?.blocked ?? 0

  const percent = totalSteps ? (stepsDone / totalSteps) * 100 : 0
  const animated = useCountUp(percent, !loading)

  if (locked) {
    return <PlacementLocked slug={slug} maxWidth="max-w-5xl" />
  }

  if ((placementMeta.error || detail.error) && !d && /not found/i.test(placementMeta.error || detail.error || '')) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link to="/placements" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to placements
        </Link>
        <p className="mt-8 text-slate-500">Placement not found.</p>
      </div>
    )
  }

  const sections: Section[] = [
    {
      icon: ListChecks,
      tone: 'violet',
      title: 'Integration Steps',
      description: 'Tracked automatically as you integrate.',
      done: integrationConfigured,
      status: `${stepsDone}/${totalSteps} steps`,
      onClick: () => d && setShowSteps(true),
    },
    {
      icon: ArrowLeftRight,
      tone: 'emerald',
      title: 'S2S Callbacks',
      description: 'Receive a server callback for each conversion.',
      done: s2sActive,
      status: s2sActive ? 'Active' : 'Disabled',
      to: `/placements/${slug}/config/s2s`,
    },
    {
      icon: Megaphone,
      tone: 'fuchsia',
      title: 'Promotions',
      description: 'Run time-bound reward boosts to drive engagement.',
      done: promotionsCount > 0,
      status: `${promotionsCount} ${promotionsCount === 1 ? 'event' : 'events'}`,
      to: `/placements/${slug}/config/promotions`,
    },
    {
      icon: Ban,
      tone: 'rose',
      title: 'Offers Control',
      description: 'Choose which offers appear on your wall.',
      done: blockedCount > 0,
      status: `${blockedCount} blocked`,
      to: `/placements/${slug}/config/offers`,
    },
  ]

  // Readiness is driven by the integration checklist; S2S being live confirms launch.
  const readyToLaunch = integrationConfigured && s2sActive
  const remaining = Math.max(0, totalSteps - stepsDone)
  const placementName = d?.placement.name ?? placementMeta.data?.placement.name

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to={`/placements/${slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to {placementName ?? 'placement'}
      </Link>

      {/* Hero banner: readiness at a glance */}
      <div className="relative mt-4 overflow-hidden rounded-3xl bg-slate-900 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-violet/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-brand-fuchsia/20 blur-3xl" />

        <div className="relative flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
              {placementName ?? ' '}
            </p>
            <h1 className="mt-1.5 flex items-center justify-center gap-2 font-display text-3xl font-bold tracking-tight text-white sm:justify-start">
              Configurations
              {(placementMeta.isRefreshing || detail.isRefreshing) && <InlineSpinner className="h-4 w-4 text-white" />}
            </h1>

            <div className="mt-4">
              {loading ? (
                <div className="mx-auto h-7 w-40 animate-pulse rounded-full bg-white/10 sm:mx-0" />
              ) : readyToLaunch ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-300">
                  <Rocket size={15} /> Ready to go live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-sm font-semibold text-amber-300">
                  {remaining} step{remaining === 1 ? '' : 's'} remaining
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-6 text-white/60">
              {loading
                ? 'Loading configuration status…'
                : readyToLaunch
                  ? 'All required setup is complete. Your placement is ready to start earning.'
                  : 'Finish the integration checklist and enable S2S callbacks to launch.'}
            </p>
          </div>

          {loading ? (
            <div className="h-[148px] w-[148px] shrink-0 animate-pulse rounded-full border-[12px] border-white/10" />
          ) : (
            <ProgressRing value={animated} />
          )}
        </div>
      </div>

      {/* Configuration sections */}
      <div className={`mt-6 divide-y divide-slate-100 overflow-hidden ${CARD}`}>
        {loading
          ? [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)
          : sections.map((section) => <ConfigRow key={section.title} section={section} />)}
      </div>

      {showSteps && d && <IntegrationStepsModal steps={steps} onClose={() => setShowSteps(false)} />}
    </div>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, CheckCircle2, ChevronDown, Copy, Eye, EyeOff, Info, LoaderCircle, Pencil, Plus, RefreshCw, Search, Send, SlidersHorizontal, Terminal, Trash2, X } from 'lucide-react'

import { type PostbackParam } from '../lib/placements'
import { apiGet, apiSend } from '../lib/auth'
import { toast, getReadableErrorMessage } from '@/components/toast'
import { useRateLimitCooldown } from '../lib/useRateLimitCooldown'
import { useCachedSection } from '../store/useCachedSection'
import { useAppDispatch } from '../store'
import { fetchSuccess, invalidateByPrefix } from '../store/cacheSlice'
import { CACHE_TTL, cacheKeyFor } from '../store/cache'
import InlineSpinner from '../components/InlineSpinner'
import PlacementLocked from '../components/PlacementLocked'

const CARD = 'relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 transition-all duration-200 hover:shadow-md'
const field =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20'

function normalizeCallbackUrl(value: string) {
  const url = value.trim()
  if (!url) return ''
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `http://${url}`
}

function Switch({ on, onChange, disabled = false }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        on ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

// Required system params: always sent. The key (name) is publisher-editable, the
// {macro} value is fixed/locked and can't be removed.
const DEFAULT_PARAMS: PostbackParam[] = [
  { key: 'user_id', value: '{user_id}', required: true },
  { key: 'offer_id', value: '{offer_id}', required: true },
  { key: 'tx_id', value: '{tx_id}', required: true },
  { key: 'amount', value: '{amount}', required: true },
  { key: 'signature', value: '{signature}', required: true },
]
const LEGACY_PARAM_VALUES = new Set([
  '{token}',
  '{txn_id}',
  '{transaction_id}',
  '{placement_id}',
  '{click_id}',
  '{offer_category}',
  '{payout}',
])
function completeParams(params: PostbackParam[] = []) {
  const normalized = params.map((param) => ({ ...param, required: !!param.required }))
  const byValue = new Map(normalized.map((param) => [param.value, param]))
  const defaults = DEFAULT_PARAMS.map((param) => {
    const existing = byValue.get(param.value)
    return existing ? { ...existing, required: param.required } : param
  })
  const defaultValues = new Set(DEFAULT_PARAMS.map((param) => param.value))
  const custom = normalized
    .filter((param) => !defaultValues.has(param.value) && !LEGACY_PARAM_VALUES.has(param.value))
    .filter((param) => !(param.value === '{signature}' && param.required))
  return [...defaults, ...custom]
}

// Stable serialization of a param set, used to detect unsaved edits.
const serializeParams = (ps: PostbackParam[]) =>
  JSON.stringify(ps.map((p) => ({ key: p.key, value: p.value, required: !!p.required })))

// The saved baseline the form is compared against to know if it's "dirty".
// Mirrors exactly how the form is hydrated from the loaded detail data, so a
// freshly-loaded (or freshly-saved) page reads as clean.
function baselineSnapshot(d?: DetailData | null) {
  const pb = d?.postback
  return {
    enabled: pb ? pb.enabled : false,
    method: (pb ? pb.method : 'GET') as 'GET' | 'POST',
    postbackUrl: pb ? pb.callbackUrl ?? '' : '',
    rewardName: d?.placement.rewardCurrencyName || 'Coins',
    exchangeRate: String(d?.placement.exchangeRate ?? 1000),
    params: serializeParams(pb?.params?.length ? completeParams(pb.params) : DEFAULT_PARAMS),
  }
}

// Suggestions for the custom-param value combobox (select or type your own).
const MACRO_OPTIONS = [
  '{user_id}',
  '{ip}',
  '{country}',
  '{offer_id}',
  '{goal_id}',
  '{offer_name}',
  '{goal_name}',
  '{tx_id}',
  '{clicked_at}',
  '{converted_at}',
  '{status}',
  '{amount}',
  '{currency}',
  '{sub_id1}',
  '{sub_id2}',
  '{sub_id3}',
  '{sub_id4}',
  '{sub_id5}',
  '{signature}',
  '{timestamp}',
]

// What each macro resolves to — shown in the hover tooltip.
const MACRO_INFO: Record<string, string> = {
  '{user_id}': 'Your unique identifier for the rewarded user.',
  '{amount}': 'Final reward amount after promotion and exchange rate.',
  '{token}': 'One-time token identifying this conversion.',
  '{signature}': 'HMAC-SHA256: hash_hmac(sha256, offer_id|user_id|tx_id, secret).',
  '{txn_id}': 'AsyncAds transaction ID for reconciliation.',
  '{placement_id}': 'AsyncAds placement identifier connected to this callback.',
  '{offer_id}': 'Identifier of the completed offer.',
  '{goal_id}': 'AsyncAds goal key connected to this conversion.',
  '{offer_name}': 'Display name of the completed offer.',
  '{click_id}': 'Click identifier connected to the conversion.',
  '{country}': "User's two-letter country code.",
  '{timestamp}': 'UTC time when the conversion was recorded.',
}

const MACRO_REFERENCE: Record<string, { description: string; category: string; example: string }> = {
  '{user_id}': { description: 'ID of the user who completed the offer', category: 'User', example: 'u_8f3a91' },
  '{ip}': { description: "User's IP address at the time of click", category: 'User', example: '203.0.113.10' },
  '{country}': { description: 'ISO country code of the user', category: 'User', example: 'US' },
  '{offer_id}': { description: 'Internal offer identifier', category: 'Offer', example: 'OF-1042' },
  '{goal_id}': { description: 'AsyncAds goal key', category: 'Offer', example: 'goal_reach_village_15' },
  '{offer_name}': { description: 'Human-readable offer name', category: 'Offer', example: 'Coin Master - Village 15' },
  '{goal_name}': { description: 'Human-readable goal name', category: 'Offer', example: 'Reach Village 15' },
  '{tx_id}': { description: 'Unique transaction ID for this conversion', category: 'Event', example: 'tx_8f3a91c2' },
  '{clicked_at}': { description: 'Unix timestamp of the click', category: 'Event', example: '1746974618' },
  '{converted_at}': { description: 'Unix timestamp of the conversion', category: 'Event', example: '1747067432' },
  '{status}': { description: 'Conversion status text', category: 'Event', example: 'approved' },
  '{amount}': { description: 'Final user reward after promotion and exchange rate', category: 'Money', example: '1250' },
  '{currency}': { description: 'Reward currency name shown in the wall', category: 'Money', example: 'Coins' },
  '{sub_id1}': { description: 'Custom tracking value passed at click time', category: 'Tracking', example: 'campaign-a' },
  '{sub_id2}': { description: 'Second custom tracking value', category: 'Tracking', example: 'creative-12' },
  '{sub_id3}': { description: 'Third custom tracking value', category: 'Tracking', example: 'source-app' },
  '{sub_id4}': { description: 'Fourth custom tracking value', category: 'Tracking', example: 'placement-top' },
  '{sub_id5}': { description: 'Fifth custom tracking value', category: 'Tracking', example: 'variant-b' },
  '{signature}': {
    description: 'hash_hmac(sha256, offer_id|user_id|tx_id, secret)',
    category: 'Security',
    example: 'f4c2...',
  },
  '{timestamp}': { description: 'Unix timestamp included in the signed callback payload', category: 'Security', example: '1747067432' },
}

function macroInfo(value: string) {
  const meta = MACRO_REFERENCE[value]
  return meta ? `${meta.category} - ${meta.description}. Example: ${meta.example}.` : MACRO_INFO[value]
}

/** Small hover tooltip shown above its trigger. */
function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-30 mb-1.5 w-max max-w-[220px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

/** Builds a preview URL from the base and the configured parameters. */
function buildUrl(base: string, params: PostbackParam[]) {
  const query = params
    .filter((p) => p.key.trim())
    .map((p) => `${p.key}=${p.value}`)
    .join('&')
  if (!query) return base
  return base + (base.includes('?') ? '&' : '?') + query
}

const SAMPLE_VALUES: Record<string, string> = {
  '{user_id}': 'user_8f2a',
  '{amount}': '1101.1',
  '{token}': 'test_token_42',
  '{signature}': 'sig_test',
  '{txn_id}': 'tx_test_1001',
  '{placement_id}': 'puzzle-quest',
  '{offer_id}': 'coin-master',
  '{goal_id}': 'goal_reach_village_15',
  '{offer_name}': 'Coin Master',
  '{click_id}': 'clk_test_9d2a',
  '{country}': 'US',
  '{timestamp}': '2026-06-05T12:00:00Z',
}

const REFERENCE_SAMPLE_VALUES: Record<string, string> = {
  '{user_id}': 'u_8f3a91',
  '{ip}': '203.0.113.10',
  '{country}': 'US',
  '{offer_id}': 'OF-1042',
  '{goal_id}': 'goal_reach_village_15',
  '{offer_name}': 'Coin Master - Village 15',
  '{goal_name}': 'Reach Village 15',
  '{tx_id}': 'tx_8f3a91c2',
  '{clicked_at}': '1746974618',
  '{converted_at}': '1747067432',
  '{status}': 'approved',
  '{amount}': '1250',
  '{currency}': 'Coins',
  '{sub_id1}': 'campaign-a',
  '{sub_id2}': 'creative-12',
  '{sub_id3}': 'source-app',
  '{sub_id4}': 'placement-top',
  '{sub_id5}': 'variant-b',
  '{signature}': 'f4c2...',
  '{timestamp}': '1747067432',
}

function sampleValue(value: string, secretKey: string, overrides: Record<string, string> = {}) {
  const override = overrides[value]?.trim()
  if (override) return override
  if (value === '{signature}') return `sig_${secretKey.slice(-10)}`
  return REFERENCE_SAMPLE_VALUES[value] ?? SAMPLE_VALUES[value] ?? value
}

function buildSampleUrl(base: string, params: PostbackParam[], secretKey: string, overrides: Record<string, string> = {}) {
  const query = params
    .filter((p) => p.key.trim())
    .map((p) => `${p.key}=${encodeURIComponent(sampleValue(p.value, secretKey, overrides))}`)
    .join('&')
  if (!query) return base
  return base + (base.includes('?') ? '&' : '?') + query
}

const generateTxId = () => `tx_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`

const SENDING_LINES = [
  'Preparing server-to-server callback payload...',
  'Resolving macros and signature...',
  'Opening connection to webhook host...',
  'Waiting for publisher response...',
]

function TerminalLogs({
  state,
  method,
  url,
  result,
}: {
  state: 'idle' | 'sending' | 'success' | 'error'
  method: 'GET' | 'POST'
  url: string
  result: TestResponse | null
}) {
  const [revealed, setRevealed] = useState(0)
  const [prevState, setPrevState] = useState(state)
  if (prevState !== state) {
    setPrevState(state)
    setRevealed(0)
  }

  useEffect(() => {
    if (state !== 'sending') return
    const timer = setInterval(() => setRevealed((n) => Math.min(n + 1, SENDING_LINES.length)), 150)
    return () => clearInterval(timer)
  }, [state])

  const cleanUrl = url || 'https://your.app/asyncads/postback'
  const responseText = result?.body?.trim() || result?.error || 'empty'
  const logs =
    state === 'idle' && !result
      ? ['$ ready to test callback endpoint...']
      : state === 'sending'
        ? SENDING_LINES.slice(0, revealed)
        : [
            ...SENDING_LINES,
            `POSTBACK ${method} ${(result?.url || cleanUrl).substring(0, 76)}${(result?.url || cleanUrl).length > 76 ? '...' : ''}`,
            `HTTP status: ${result?.statusCode ?? 'no response'}`,
            `Response body: ${responseText}`,
            result?.accepted ? 'Status: callback accepted.' : 'Status: callback was not accepted. Endpoint must return body "1" or "OK".',
          ]

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 shadow-inner">
      <div className="mb-3 flex items-center gap-2 border-b border-slate-900 pb-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
        <span className="ml-1.5 text-[9px] uppercase tracking-wider text-slate-500">Postback Terminal Output</span>
      </div>
      <div className="max-h-48 space-y-1.5 overflow-y-auto font-mono text-[11px] leading-relaxed">
        {logs.map((log, i) => {
          let colorClass = 'text-slate-400'
          if (log.startsWith('Status: callback accepted')) {
            colorClass = 'text-emerald-400 font-semibold'
          } else if (log.startsWith('Status: callback was not accepted')) {
            colorClass = 'text-red-400 font-semibold'
          } else if (log.startsWith('POSTBACK')) {
            colorClass = 'text-brand-fuchsia font-semibold'
          } else if (log.startsWith('$')) {
            colorClass = 'text-slate-500'
          }
          return (
            <div key={i} className={colorClass}>
              {log}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Category display order for the value picker.
const MACRO_CATEGORY_ORDER = ['User', 'Offer', 'Event', 'Money', 'Tracking', 'Security']

/**
 * Per-row Value picker shown on a new (not-yet-chosen) parameter row. Publishers
 * never type a value freely — they pick an allowed macro from this searchable,
 * category-grouped menu. Picking sets the row's value and auto-fills the key.
 */
function RowValuePicker({ options, onPick }: { options: string[]; onPick: (macro: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ left: number; width: number; maxHeight: number; top?: number; bottom?: number } | null>(null)

  // Position a fixed, portalled menu anchored to the trigger so the modal's
  // overflow can't clip it. Sizes to the available space and flips above when
  // there isn't enough room below; follows the trigger on scroll/resize.
  function place() {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(Math.max(r.width, 320), window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12))
    const spaceBelow = window.innerHeight - r.bottom - 12
    const spaceAbove = r.top - 12
    const below = spaceBelow >= 260 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(180, Math.min(360, below ? spaceBelow : spaceAbove))
    setRect(below
      ? { left, width, maxHeight, top: r.bottom + 4 }
      : { left, width, maxHeight, bottom: window.innerHeight - r.top + 4 })
  }

  function close() {
    setOpen(false)
    setQuery('')
  }
  function openMenu() {
    place()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      close()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('resize', place)
    // Capture phase catches the scrolling modal body too.
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const matches = options.filter((macro) => {
    if (!q) return true
    const meta = MACRO_REFERENCE[macro]
    return (
      macro.toLowerCase().includes(q) ||
      (meta?.description.toLowerCase().includes(q) ?? false) ||
      (meta?.category.toLowerCase().includes(q) ?? false)
    )
  })

  // Group matches by category, preserving the canonical order; uncategorized last.
  const groups = MACRO_CATEGORY_ORDER
    .map((category) => ({ category, items: matches.filter((m) => MACRO_REFERENCE[m]?.category === category) }))
    .filter((g) => g.items.length > 0)
  const uncategorized = matches.filter((m) => !MACRO_REFERENCE[m])
  if (uncategorized.length) groups.push({ category: 'Other', items: uncategorized })

  function pick(macro: string) {
    onPick(macro)
    close()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? close() : openMenu())}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-400 transition-colors hover:border-brand-fuchsia/50 focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
      >
        <span className="font-mono">Select a value</span>
        <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && rect && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width, maxHeight: rect.maxHeight }}
          className="z-[60] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {/* Search */}
          <div className="shrink-0 border-b border-slate-100 p-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matches.length) pick(matches[0])
                  if (e.key === 'Escape') close()
                }}
                placeholder="Search values…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
              />
            </div>
          </div>

          {/* Grouped list of values still available */}
          <div className="flex-1 overflow-auto py-1">
            {options.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">All values are already in use.</p>
            ) : groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">No values match “{query}”.</p>
            ) : (
              groups.map((group) => (
                <div key={group.category}>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{group.category}</p>
                  {group.items.map((macro) => {
                    const meta = MACRO_REFERENCE[macro]
                    return (
                      <button
                        key={macro}
                        type="button"
                        onClick={() => pick(macro)}
                        className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-brand-fuchsia/5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-sm font-semibold text-slate-700">{macro}</span>
                          {meta && <span className="block truncate text-xs text-slate-400">{meta.description}</span>}
                        </span>
                        {meta && (
                          <code className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{meta.example}</code>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// Preset reward currency names; anything else counts as a custom name.
const REWARD_PRESETS = ['Coins', 'Gems', 'Points']

/** Small modal for entering a custom reward currency name. */
function CustomCurrencyModal({
  initial,
  onClose,
  onSave,
}: {
  initial: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(initial)
  const valid = !!name.trim()

  function save() {
    if (!valid) return
    onSave(name.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Custom currency name</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
          maxLength={30}
          placeholder="e.g. Diamonds"
          className={field}
        />
        <p className="mt-1.5 text-xs text-slate-400">Shown to your users when rewards are credited.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!valid}
            className="rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save name
          </button>
        </div>
      </div>
    </div>
  )
}

/** Explains how the reward exchange rate converts USD payouts into in-app currency. */
function RewardRateHelpModal({ currency, rate, onClose }: { currency: string; rate: number; onClose: () => void }) {
  const fmt = (n: number) => n.toLocaleString()
  const examples = [
    { usd: '$1.00', reward: rate },
    { usd: '$0.50', reward: Math.round(rate * 0.5) },
    { usd: '$0.10', reward: Math.round(rate * 0.1) },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-br from-brand-fuchsia/5 to-transparent p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-fuchsia/10 text-brand-fuchsia">
            <Info size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">Exchange rate</h2>
            <p className="mt-0.5 text-sm text-slate-500">How USD payouts become {currency}.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 transition-colors hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-600">
            Offer payouts are priced in US dollars. This rate sets how many{' '}
            <span className="font-semibold text-slate-900">{currency}</span> a user earns per{' '}
            <span className="font-semibold text-slate-900">$1</span> of payout.
          </p>

          {/* Formula */}
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
            <span>{currency}</span>
            <span className="text-slate-400">=</span>
            <span>USD payout</span>
            <span className="text-slate-400">×</span>
            <span className="text-brand-fuchsia">{fmt(rate)}</span>
          </div>

          {/* Worked examples */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>Payout</span>
              <span>User receives</span>
            </div>
            <div className="divide-y divide-slate-100">
              {examples.map((ex) => (
                <div key={ex.usd} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-700">{ex.usd}</span>
                  <span className="font-semibold text-brand-fuchsia">
                    {fmt(ex.reward)} {currency}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs leading-5 text-slate-400">
            The <code className="font-mono text-slate-500">{'{amount}'}</code> sent to your postback already reflects this
            rate (and any active promotion) — credit the user exactly what you receive.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

function ParamsModal({
  initial,
  onClose,
  onSave,
}: {
  initial: PostbackParam[]
  onClose: () => void
  onSave: (params: PostbackParam[]) => Promise<void>
}) {
  const [rows, setRows] = useState<PostbackParam[]>(completeParams(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (saving) return
    // Drop incomplete rows where no value/macro was chosen yet.
    const chosen = rows.filter((r) => r.value !== '')
    // Only the Key is publisher-controlled — values are fixed system macros, so
    // validation is limited to the keys (non-empty, safe format, unique).
    const trimmed = chosen.map((r) => ({ ...r, key: r.key.trim() }))
    if (trimmed.some((r) => r.key === '')) {
      setError('Every parameter needs a key.')
      return
    }
    if (trimmed.some((r) => !/^[A-Za-z0-9_]+$/.test(r.key))) {
      setError('Keys may only contain letters, numbers, and underscores.')
      return
    }
    const lowerKeys = trimmed.map((r) => r.key.toLowerCase())
    if (new Set(lowerKeys).size !== lowerKeys.length) {
      setError('Each parameter key must be unique.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save parameters.')
    } finally {
      setSaving(false)
    }
  }

  const updateKey = (i: number, key: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, key } : r)))
  // "Add another parameter" appends an empty row at the bottom; its value is
  // chosen via the row's value picker.
  const addEmptyRow = () => setRows((rs) => [...rs, { key: '', value: '', required: false }])
  // Picking a macro for a row locks its value and, if the key is still blank,
  // defaults the key to the macro name (which stays editable).
  const setRowValue = (i: number, macro: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, value: macro, key: r.key.trim() || macro.replace(/[{}]/g, '') } : r)))
  const remove = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const keyInput =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20'

  // Macros already assigned to a row — excluded from the add menu's options.
  const usedValues = new Set(rows.map((r) => r.value).filter(Boolean))
  const availableMacros = MACRO_OPTIONS.filter((o) => !usedValues.has(o))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Pinned header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Configure postback parameters</h2>
            <p className="mt-1 text-sm text-slate-500">Start with required parameters. Add optional macros when you need them.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-x-3 gap-y-2">
          {/* Column headers */}
          <span className="text-sm font-medium text-slate-700">
            Key <span className="text-red-500">*</span>
          </span>
          <span className="text-sm font-medium text-slate-700">
            Value <span className="text-red-500">*</span>
          </span>
          <span />

          {rows.map((row, i) => (
            <div key={i} className="contents">
              {/* Key — publisher-editable for every row */}
              <input
                value={row.key}
                onChange={(e) => updateKey(i, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="Key"
                className={keyInput}
              />

              {/* Value — picker until chosen, then a locked read-only macro chip */}
              {row.value ? (
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">
                  <code className="truncate font-mono text-sm text-slate-500">{row.value}</code>
                </div>
              ) : (
                <RowValuePicker options={availableMacros} onPick={(macro) => setRowValue(i, macro)} />
              )}

              {/* Action — info once a value is chosen; delete for optional rows */}
              <span className="flex items-center gap-1 text-slate-400">
                {row.value && (
                  <Tooltip
                    label={
                      macroInfo(row.value) ??
                      (row.required
                        ? 'Required parameter sent with every callback.'
                        : 'Optional macro sent with every callback.')
                    }
                  >
                    <span className="cursor-help">
                      <Info size={17} />
                    </span>
                  </Tooltip>
                )}
                {!row.required && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label="Delete parameter"
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addEmptyRow}
          disabled={availableMacros.length === 0}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-fuchsia transition-colors hover:text-brand-violet disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <Plus size={16} /> Add another parameter
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        </div>

        {/* Pinned footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90 disabled:opacity-50"
          >
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save parameters'}
          </button>
        </div>
      </div>
    </div>
  )
}

type TestResponse = {
  ok: boolean
  accepted: boolean
  method: 'GET' | 'POST'
  url: string
  payload: Record<string, string>
  statusCode: number | null
  body: string
  error: string | null
}

type TestRequest = {
  method: 'GET' | 'POST'
  callbackUrl: string
  params: PostbackParam[]
  values: Record<string, string>
}

function TestEndpointModal({
  method,
  postbackUrl,
  params,
  secretKey,
  onClose,
  onTested,
}: {
  method: 'GET' | 'POST'
  postbackUrl: string
  params: PostbackParam[]
  secretKey: string
  onClose: () => void
  onTested: (request: TestRequest) => Promise<TestResponse>
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<TestResponse | null>(null)
  const sendingRef = useRef(false)

  // Editable test values — substituted into the matching macros below.
  const [userId, setUserId] = useState('u_8f3a91')
  const [offerId, setOfferId] = useState('OF-1042')
  const [offerName, setOfferName] = useState('Coin Master - Village 15')
  const [goalId, setGoalId] = useState('goal_reach_village_15')
  const [goalName, setGoalName] = useState('Reach Village 15')
  const [txId, setTxId] = useState(generateTxId)

  const overrides: Record<string, string> = {
    '{user_id}': userId,
    '{offer_id}': offerId,
    '{offer_name}': offerName,
    '{goal_id}': goalId,
    '{goal_name}': goalName,
    '{tx_id}': txId,
  }

  const endpoint = postbackUrl.trim() || 'https://your.app/asyncads/postback'
  const previewUrl = buildSampleUrl(endpoint, params, secretKey, overrides)
  const ready = !!postbackUrl.trim()

  async function sendTest() {
    if (sendingRef.current || !ready) return
    sendingRef.current = true
    setState('sending')
    setResult(null)
    try {
      const response = await onTested({
        method,
        callbackUrl: endpoint,
        params,
        values: {
          user_id: userId,
          offer_id: offerId,
          offer_name: offerName,
          goal_id: goalId,
          goal_name: goalName,
          tx_id: txId,
        },
      })
      setResult(response)
      setState(response.accepted ? 'success' : 'error')
    } catch (err) {
      setResult({
        ok: false,
        accepted: false,
        method,
        url: endpoint,
        payload: {},
        statusCode: null,
        body: '',
        error: err instanceof Error ? err.message : 'Could not send test callback.',
      })
      setState('error')
    } finally {
      sendingRef.current = false
    }
  }

  const testField =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Pinned header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-2">
            <Terminal size={20} className="text-brand-fuchsia" />
            <h2 className="text-lg font-semibold text-slate-900">Test webhook postback</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Editable test values */}
        <p className="mb-1.5 text-sm font-medium text-slate-700">Test values</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">User ID</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="u_8f3a91" className={testField} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Transaction ID (generated)</label>
              <div className="relative">
                <input readOnly value={txId} className={`${testField} pr-9 text-slate-500`} />
                <button
                  type="button"
                  onClick={() => setTxId(generateTxId())}
                  aria-label="Generate new transaction ID"
                  title="Generate new transaction ID"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-brand-fuchsia"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Offer ID</label>
              <input value={offerId} onChange={(e) => setOfferId(e.target.value)} placeholder="OF-1042" className={testField} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Offer name</label>
              <input value={offerName} onChange={(e) => setOfferName(e.target.value)} placeholder="Coin Master" className={testField} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Goal ID</label>
              <input value={goalId} onChange={(e) => setGoalId(e.target.value)} placeholder="goal_reach_village_15" className={testField} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Goal name</label>
              <input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Reach Village 15" className={testField} />
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Substituted into the matching macros of your configured parameters.
          </p>
        </div>

        <p className="mb-1.5 mt-5 text-sm font-medium text-slate-700">Payload Preview</p>
        <div className="max-h-40 overflow-auto rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <code className="whitespace-nowrap font-mono text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{method}</span> {previewUrl}
          </code>
        </div>

        {/* Custom Terminal Simulator Component */}
        <TerminalLogs state={state} method={method} url={previewUrl} result={result} />

        {state === 'success' && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700 animate-fadeIn">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold">Real test accepted</p>
              <p className="mt-0.5 text-emerald-600">
                Your endpoint returned {result?.statusCode ?? 200} with body "{result?.body?.trim() || '1'}".
              </p>
            </div>
          </div>
        )}
        </div>

        {/* Pinned footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={sendTest}
            disabled={state === 'sending' || !ready}
            title={ready ? undefined : 'Add a callback URL first'}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90 shadow-sm shadow-brand-fuchsia/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state === 'sending' ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
            {state === 'sending' ? 'Sending...' : 'Send test'}
          </button>
        </div>
      </div>
    </div>
  )
}

type DetailData = {
  placement: { rewardCurrencyName: string; exchangeRate: number; secretKey: string | null }
  postback: {
    enabled: boolean
    method: 'GET' | 'POST'
    callbackUrl: string | null
    params: PostbackParam[]
  } | null
}
type PlacementMetaData = { placement: { status: string } }

const LOCKED_STATUSES = ['draft', 'pending_review']

/** Confirmation shown when leaving the page with unsaved edits. */
function LeaveConfirmModal({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onStay} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-500">
            <Info size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">Unsaved changes</h2>
            <p className="mt-1 text-sm text-slate-500">
              You have unsaved changes. If you leave now, your edits will be lost.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600"
          >
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  )
}

export default function S2SConfig() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const placementMeta = useCachedSection<PlacementMetaData>({
    key: 'placements.detail',
    params: { slug },
    ttl: CACHE_TTL['placements.detail'],
    fetcher: (signal) => apiGet(`/api/placements/${slug}`, { signal }),
  })
  const status = placementMeta.data?.placement.status
  const locked = status ? LOCKED_STATUSES.includes(status) : false

  const detail = useCachedSection<DetailData>({
    key: 'placements.postback',
    params: { slug, defaults: 'v7' },
    ttl: CACHE_TTL['placements.postback'],
    enabled: Boolean(status && !locked),
    fetcher: (signal) => apiGet(`/api/placements/${slug}/postback`, { signal }),
  })
  const postbackCacheKey = cacheKeyFor('placements.postback', { slug, defaults: 'v7' })

  const [method, setMethod] = useState<'GET' | 'POST'>('GET')
  // Default OFF: a freshly-created placement has no postback config yet, so the
  // hydration block below never runs setEnabled — it must read as Disabled, not
  // fall back to a stale "Active".
  const [enabled, setEnabled] = useState(false)
  const [postbackUrl, setPostbackUrl] = useState('')
  const [rewardName, setRewardName] = useState('Coins')
  const [exchangeRate, setExchangeRate] = useState('1000')
  const [params, setParams] = useState<PostbackParam[]>(DEFAULT_PARAMS)
  const [configuringParams, setConfiguringParams] = useState(false)
  const [editingCurrencyName, setEditingCurrencyName] = useState(false)
  const [rateHelpOpen, setRateHelpOpen] = useState(false)
  const [testingEndpoint, setTestingEndpoint] = useState(false)
  const [revealSecret, setRevealSecret] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  // Per-action cooldown: a 429 on save disables just this button (not the page).
  const saveCooldown = useRateLimitCooldown()

  // Populate the form once the detail data first arrives (adjusted during
  // render — React re-renders immediately with the hydrated values).
  if (detail.data && !hydrated) {
    setHydrated(true)
    const d = detail.data
    if (d.postback) {
      setEnabled(d.postback.enabled)
      setMethod(d.postback.method)
      setPostbackUrl(d.postback.callbackUrl ?? '')
      if (d.postback.params?.length) setParams(completeParams(d.postback.params))
    }
    setRewardName(d.placement.rewardCurrencyName || 'Coins')
    setExchangeRate(String(d.placement.exchangeRate ?? 1000))
  }

  if (locked) {
    return <PlacementLocked slug={slug} maxWidth="max-w-3xl" />
  }

  if (placementMeta.isLoading || detail.isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <Link
          to={`/placements/${slug}/config`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to configurations
        </Link>
        <div className="mt-8 flex h-64 items-center justify-center">
          <InlineSpinner className="h-8 w-8 text-brand-fuchsia" />
        </div>
      </div>
    )
  }

  if (detail.error && !detail.data && /must be accepted/i.test(detail.error)) {
    return <PlacementLocked slug={slug} maxWidth="max-w-3xl" />
  }

  const error = placementMeta.error || detail.error
  if (error && !detail.data && /not found/i.test(error)) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link to="/placements" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft size={16} /> Back to placements
        </Link>
        <p className="mt-8 text-slate-500">Placement not found.</p>
      </div>
    )
  }

  async function handleSave() {
    if (savingRef.current || saving || saveCooldown.active) return
    savingRef.current = true
    setSaving(true)
    try {
      const callbackUrlForSave = normalizeCallbackUrl(postbackUrl)
      const res = await apiSend<{ ok: boolean; params?: PostbackParam[] }>('PUT', `/api/placements/${slug}/postback`, {
        enabled,
        method,
        callbackUrl: callbackUrlForSave,
        params: params.map((p) => ({ key: p.key, value: p.value, required: p.required })),
      })
      // The server normalizes the set (restores system macros, drops invalid
      // rows) — reflect its truth in the UI.
      const normalizedParams = completeParams(res.params ?? params)
      setParams(normalizedParams)
      setPostbackUrl(callbackUrlForSave)
      await apiSend('PUT', `/api/placements/${slug}/reward`, {
        rewardCurrencyName: rewardName.trim() || 'Coins',
        exchangeRate: Number(exchangeRate) || 0,
      })
      dispatch(
        fetchSuccess({
          key: postbackCacheKey,
          data: {
            placement: {
              rewardCurrencyName: rewardName.trim() || 'Coins',
              exchangeRate: Number(exchangeRate) || 0,
              secretKey: detail.data?.placement.secretKey ?? null,
            },
            postback: {
              enabled,
              method,
              callbackUrl: callbackUrlForSave || null,
              params: normalizedParams,
            },
          },
        }),
      )
      dispatch(invalidateByPrefix('placements.config'))
      dispatch(invalidateByPrefix('placements.overview'))
      dispatch(invalidateByPrefix('placements.list'))
      dispatch(invalidateByPrefix('dashboard.'))
      setSaved(true)
      toast.success({ title: 'Saved', message: 'Callbacks saved.' })
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      // On a 429 the global interceptor already shows the rate-limit toast and
      // we start the button cooldown — skip the generic error toast. Other
      // errors fall through to the normal message.
      if (!saveCooldown.startFromError(err)) {
        toast.error({ title: 'Could not save', message: getReadableErrorMessage(err) })
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  /** Persists the param set right away (called from the params modal). */
  async function saveParams(next: PostbackParam[]) {
    const res = await apiSend<{ ok: boolean; params?: PostbackParam[] }>('PUT', `/api/placements/${slug}/postback`, {
      paramsOnly: true,
      params: next.map((p) => ({ key: p.key, value: p.value, required: p.required })),
    })
    const normalizedParams = completeParams(res.params ?? next)
    setParams(normalizedParams)
    if (detail.data) {
      dispatch(
        fetchSuccess({
          key: postbackCacheKey,
          data: {
            ...detail.data,
            postback: {
              enabled: detail.data.postback?.enabled ?? enabled,
              method: detail.data.postback?.method ?? method,
              callbackUrl: detail.data.postback?.callbackUrl ?? null,
              params: normalizedParams,
            },
          },
        }),
      )
    }
    dispatch(invalidateByPrefix('placements.config'))
  }

  // The signing secret lives on the placement, generated server-side.
  // The mask mirrors the key's shape: every group starred except the last
  // one, so the field stays the same width whether revealed or hidden.
  const secretKey = detail.data?.placement.secretKey ?? ''
  const secretDisplay = secretKey
    ? revealSecret
      ? secretKey
      : secretKey
          .split('-')
          .map((group, i, all) => (i === all.length - 1 ? group : '*'.repeat(group.length)))
          .join('-')
    : '—'
  const hasCallbackUrl = !!postbackUrl.trim()

  // Unsaved-changes detection: compare the live form against the last saved
  // baseline (detail.data, which the cache updates on every successful save, so
  // saving clears the dirty flag without extra bookkeeping).
  const baseline = baselineSnapshot(detail.data)
  const dirty =
    hydrated &&
    (enabled !== baseline.enabled ||
      method !== baseline.method ||
      postbackUrl !== baseline.postbackUrl ||
      rewardName !== baseline.rewardName ||
      exchangeRate !== baseline.exchangeRate ||
      serializeParams(params) !== baseline.params)

  const configPath = `/placements/${slug}/config`

  // Return to the page the user came from; fall back to the config page when the
  // wall was opened directly (no in-app history to go back to).
  function goBack() {
    const idx = typeof window.history.state?.idx === 'number' ? window.history.state.idx : 0
    if (idx > 0) navigate(-1)
    else navigate(configPath)
  }

  function handleBack() {
    if (dirty) setShowLeaveConfirm(true)
    else goBack()
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to configurations
      </button>

      <div className="mb-6 mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            S2S Callbacks
            {detail.isRefreshing && <InlineSpinner className="h-4 w-4" />}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            We send a server-to-server request to your endpoint whenever a user completes an offer.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || saveCooldown.active}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-brand-fuchsia px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90 disabled:opacity-50"
        >
          {saving && <LoaderCircle size={16} className="animate-spin" />}
          {saveCooldown.active
            ? `Try again in ${saveCooldown.secondsLeft}s`
            : saving
              ? 'Saving...'
              : saved
                ? 'Saved ✓'
                : 'Save callbacks'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Postback endpoint */}
          <div className={CARD}>
            <div className="p-6">
              <h2 className="font-semibold text-slate-900">Postback endpoint</h2>
              <p className="mt-1 text-sm text-slate-500">Where we deliver the callback for each conversion.</p>

              <div className={enabled ? 'mt-5' : 'pointer-events-none mt-5 opacity-50'}>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Method</label>
                <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(['GET', 'POST'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                        method === m ? 'bg-white text-brand-fuchsia shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                <label className="mb-1.5 block text-sm font-medium text-slate-700">Callback URL</label>
                <input
                  value={postbackUrl}
                  onChange={(e) => setPostbackUrl(e.target.value)}
                  placeholder="https://your.app/asyncads/postback"
                  className={`${field} font-mono`}
                />

                {/* Request preview */}
                <p className="mb-1.5 mt-5 text-sm font-medium text-slate-700">Request preview</p>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                  <code className="whitespace-nowrap font-mono text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">{method}</span>{' '}
                    {buildUrl(postbackUrl || 'https://your.app/asyncads/postback', params)}
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className={CARD}>
            <div className="p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900">Parameters</h2>
                <button
                  type="button"
                  onClick={() => setConfiguringParams(true)}
                  disabled={!hasCallbackUrl}
                  title={hasCallbackUrl ? undefined : 'Add a callback URL first'}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700 disabled:active:scale-100"
                >
                  <SlidersHorizontal size={15} />
                  Configure
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {hasCallbackUrl ? 'Sent with every callback.' : 'Add a callback URL above to configure parameters.'}
              </p>

              {params.length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                  No parameters configured.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {params.map((p) => (
                    <span
                      key={p.key}
                      className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50/40 p-1 text-xs shadow-sm shadow-slate-100 transition-all hover:scale-[1.02] hover:border-slate-300 hover:bg-white"
                    >
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-mono font-semibold text-slate-700">
                        {p.key}
                      </span>
                      <span className="px-1 text-slate-400 font-semibold">=</span>
                      <span className="rounded-lg bg-brand-fuchsia/5 px-2 py-0.5 font-mono font-bold text-brand-fuchsia">
                        {p.value}
                      </span>
                      {p.required && (
                        <span className="ml-1.5 mr-1 rounded-md bg-red-50 border border-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-500 uppercase tracking-wider">
                          Required
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reward conversion */}
          <div className={CARD}>
            <div className="p-6">
              <h2 className="font-semibold text-slate-900">Reward conversion</h2>
              <p className="mt-1 text-sm text-slate-500">How payouts map to your in-app currency.</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Currency name</label>
                  <div className="flex flex-wrap gap-2">
                    {REWARD_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRewardName(preset)}
                        className={`rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                          rewardName === preset
                            ? 'border-brand-fuchsia bg-brand-fuchsia/5 text-brand-fuchsia'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEditingCurrencyName(true)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors ${
                        !REWARD_PRESETS.includes(rewardName)
                          ? 'border-brand-fuchsia bg-brand-fuchsia/5 text-brand-fuchsia'
                          : 'border-dashed border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {REWARD_PRESETS.includes(rewardName) ? (
                        <>
                          <Plus size={14} /> Custom
                        </>
                      ) : (
                        <>
                          {rewardName} <Pencil size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Exchange rate</label>
                  <div className="flex items-stretch gap-2">
                    <input
                      type="number"
                      min={0}
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      placeholder="1000"
                      className={`${field} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => setRateHelpOpen(true)}
                      aria-label="How the exchange rate works"
                      title="How the exchange rate works"
                      className="grid w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:border-brand-fuchsia/40 hover:bg-brand-fuchsia/5 hover:text-brand-fuchsia"
                    >
                      <Info size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right rail: status, secret, test, docs */}
        <div className="space-y-6 lg:sticky lg:top-6">
          <div className={CARD}>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Callback status</p>
                  <p className={`mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium ${enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {enabled ? 'Active' : 'Disabled'}
                  </p>
                </div>
                <Switch on={enabled} disabled={saving} onChange={() => setEnabled((value) => !value)} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-400">
                {enabled
                  ? 'Conversions will be delivered to your endpoint in real time.'
                  : 'No callbacks are sent while disabled. Your settings are kept.'}
              </p>
            </div>
          </div>

          <div className={CARD}>
            <div className="p-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Secret key</label>
              <div className="relative">
                <input readOnly value={secretDisplay} className={`${field} pr-20 font-mono text-slate-600`} />
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2.5 text-slate-400">
                  <button
                    type="button"
                    disabled={!secretKey}
                    onClick={() => {
                      navigator.clipboard?.writeText(secretKey)
                      setCopiedSecret(true)
                      setTimeout(() => setCopiedSecret(false), 1500)
                      toast.success('Secret key copied to clipboard.')
                    }}
                    aria-label="Copy secret key"
                    className="transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copiedSecret ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                  <button
                    type="button"
                    disabled={!secretKey}
                    onClick={() => setRevealSecret((value) => !value)}
                    aria-label={revealSecret ? 'Hide secret key' : 'Reveal secret key'}
                    className="transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {revealSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Verify callbacks with an HMAC of the query against this key.
              </p>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setTestingEndpoint(true)}
                  disabled={!hasCallbackUrl}
                  title={hasCallbackUrl ? undefined : 'Add a callback URL first'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                >
                  <Terminal size={16} />
                  Send test callback
                </button>
                <Link
                  to="/docs#configure-s2s-postback"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <BookOpen size={16} />
                  Integration docs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {configuringParams && (
        <ParamsModal
          initial={params}
          onClose={() => setConfiguringParams(false)}
          onSave={saveParams}
        />
      )}
      {editingCurrencyName && (
        <CustomCurrencyModal
          initial={REWARD_PRESETS.includes(rewardName) ? '' : rewardName}
          onClose={() => setEditingCurrencyName(false)}
          onSave={(name) => setRewardName(name)}
        />
      )}
      {rateHelpOpen && (
        <RewardRateHelpModal
          currency={rewardName.trim() || 'Coins'}
          rate={Number(exchangeRate) || 0}
          onClose={() => setRateHelpOpen(false)}
        />
      )}
      {testingEndpoint && (
        <TestEndpointModal
          method={method}
          postbackUrl={postbackUrl}
          params={params}
          secretKey={secretKey}
          onClose={() => setTestingEndpoint(false)}
          onTested={async (request) => {
            const response = await apiSend<TestResponse>('POST', `/api/placements/${slug}/postback/test`, request)
            if (response.accepted) {
              dispatch(invalidateByPrefix('placements.config'))
            }
            return response
          }}
        />
      )}
      {showLeaveConfirm && (
        <LeaveConfirmModal
          onStay={() => setShowLeaveConfirm(false)}
          onLeave={() => {
            setShowLeaveConfirm(false)
            goBack()
          }}
        />
      )}
    </div>
  )
}

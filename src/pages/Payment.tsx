import { useMemo, useState } from 'react'
import { Check, CheckCircle2, ChevronDown, ChevronRight, Clock, DollarSign, Download, HourglassIcon, LoaderCircle, Plus, RefreshCw, TrendingUp, Wallet, X, type LucideIcon as Icon } from 'lucide-react'

import { apiGet, apiSend } from '../lib/auth'
import { useAuth } from '../lib/AuthContext'
import { useCachedSection } from '../store/useCachedSection'
import { CACHE_TTL } from '../store/cache'
import InlineSpinner from '../components/InlineSpinner'
import binanceMethodImg from '../assets/payout-methods/binance.svg'
import paypalMethodImg from '../assets/payout-methods/paypal.svg'
import usdtMethodImg from '../assets/payout-methods/usdt.svg'

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'
const field =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20'

const METHODS = [
  { id: 'binance', label: 'Binance ID', hint: 'Binance Pay', image: binanceMethodImg },
  { id: 'usdt', label: 'USDT Wallet', hint: 'On-chain', image: usdtMethodImg },
  { id: 'paypal', label: 'PayPal', hint: 'Email', image: paypalMethodImg },
] as const

const NETWORKS = ['TRC20 (Tron)', 'ERC20 (Ethereum)', 'BEP20 (BNB Chain)']

type MethodId = (typeof METHODS)[number]['id']
// What the API returns. `value` is the decrypted destination (owner-only) so the
// edit form can pre-fill it; `preview` is the masked version for lists.
type SavedMethod = { method: MethodId; network: string; preview: string; value: string }
// What the modal submits.
type MethodForm = { method: MethodId; binanceId: string; network: string; wallet: string; paypal: string }

type InvoiceRow = { number: string; periodStart: string; issuedAt: string; gross: number; chargebacks: number; amount: number; status: string }
type PaymentData = {
  balance: number
  stats: { currentPeriod: number; nextPayoutDate: string; lifetimePaid: number }
  method: SavedMethod | null
  invoices: InvoiceRow[]
}

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// Accepts 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS' (treated as local time).
const toDate = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00` : s.replace(' ', 'T'))
const fmtDate = (s: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(toDate(s))
const fmtPeriod = (s: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(toDate(s))

type Biller = { name?: string | null; company?: string | null; email?: string | null }

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Builds a self-contained, print-ready HTML invoice from data already on the client. */
function buildInvoiceHtml(inv: InvoiceRow, biller: Biller): string {
  const billTo = [biller.company, biller.name, biller.email].filter(Boolean).map((v) => escapeHtml(String(v)))
  const chargebackRow = inv.chargebacks > 0
    ? `<tr><td>Chargebacks (reversed conversions)</td><td class="num neg">-${usd(inv.chargebacks)}</td></tr>`
    : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${escapeHtml(inv.number)} — AsyncAds Invoice</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2430}
  .sheet{max-width:720px;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:40px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:28px}
  .brand{font-size:22px;font-weight:700;color:#d6006e}
  .muted{color:#5b6472;font-size:13px;line-height:1.5}
  h1{font-size:18px;margin:0 0 4px} .pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}
  th,td{text-align:left;padding:10px 0;border-bottom:1px solid #eef1f5}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8}
  .num{text-align:right;font-variant-numeric:tabular-nums} .neg{color:#e11d48}
  .total td{border-top:2px solid #1f2430;border-bottom:none;font-weight:700;font-size:16px;padding-top:14px}
  .foot{margin-top:28px;font-size:12px;color:#94a3b8}
  @media print{body{background:#fff}.sheet{border:0;margin:0;max-width:none}.noprint{display:none}}
  .btn{display:inline-block;margin:16px auto 0;background:#d6006e;color:#fff;text-decoration:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;border:0;cursor:pointer}
</style></head>
<body>
  <div class="sheet">
    <div class="top">
      <div><div class="brand">AsyncAds</div><div class="muted">AsyncAds Publisher Payouts</div></div>
      <div style="text-align:right">
        <h1>Invoice ${escapeHtml(inv.number)}</h1>
        <div class="muted">Status: <span class="pill" style="background:#f1f5f9">${escapeHtml(inv.status)}</span></div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap">
      <div><div class="muted"><strong>Billed to</strong></div><div class="muted">${billTo.length ? billTo.join('<br/>') : '—'}</div></div>
      <div style="text-align:right"><div class="muted"><strong>Period</strong>: ${escapeHtml(fmtPeriod(inv.periodStart))}</div><div class="muted"><strong>Issued</strong>: ${escapeHtml(fmtDate(inv.issuedAt))}</div></div>
    </div>
    <table>
      <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
      <tbody>
        <tr><td>Gross earnings</td><td class="num">${usd(inv.gross)}</td></tr>
        ${chargebackRow}
        <tr class="total"><td>Net paid</td><td class="num">${usd(inv.amount)}</td></tr>
      </tbody>
    </table>
    <p class="foot">Generated by AsyncAds. Amounts in USD. ${inv.chargebacks > 0 ? 'Chargebacks are conversions reversed after the sale (refunds/disputes), deducted from the gross.' : ''}</p>
    <div class="noprint" style="text-align:center"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div>
  </div>
</body></html>`
}

/** Triggers a client-side download of the invoice as a self-contained HTML file. */
function downloadInvoice(inv: InvoiceRow, biller: Biller) {
  const blob = new Blob([buildInvoiceHtml(inv, biller)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${inv.number}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const methodMeta = (id: MethodId) => METHODS.find((m) => m.id === id)!
const summarize = (s: SavedMethod) => {
  if (s.method === 'binance') return `Binance ID - ${s.preview}`
  if (s.method === 'usdt') return `USDT - ${s.network.split(' ')[0]} - ${s.preview}`
  return `PayPal - ${s.preview}`
}

function PaymentMethodModal({
  initial,
  onClose,
  onSave,
}: {
  initial: SavedMethod | null
  onClose: () => void
  onSave: (m: MethodForm, code: string) => Promise<void>
}) {
  const [method, setMethod] = useState<MethodId>(initial?.method ?? 'usdt')
  // Pre-fill the matching field from the saved (decrypted) destination on edit.
  const [binanceId, setBinanceId] = useState(initial?.method === 'binance' ? initial.value : '')
  const [network, setNetwork] = useState(initial?.network || NETWORKS[0])
  const [wallet, setWallet] = useState(initial?.method === 'usdt' ? initial.value : '')
  const [paypal, setPaypal] = useState(initial?.method === 'paypal' ? initial.value : '')
  const [networkOpen, setNetworkOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Changing payout details requires a one-time email code. After the form is
  // filled we email a code and switch to the 'verify' step before saving.
  const [phase, setPhase] = useState<'form' | 'verify'>('form')
  const [code, setCode] = useState('')
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  // Mirror the server's validation rules so an invalid destination is caught
  // before we email a code (the user shouldn't get a "valid wallet" error only
  // after typing the code).
  const valid =
    method === 'binance'
      ? /^\d{5,20}$/.test(binanceId.trim())
      : method === 'usdt'
        ? /^[A-Za-z0-9]{20,100}$/.test(wallet.trim())
        : paypal.trim().length <= 190 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypal.trim())

  const form = (): MethodForm => ({ method, binanceId: binanceId.trim(), network, wallet: wallet.trim(), paypal: paypal.trim() })

  // The challenge validates the destination server-side before emailing, so an
  // invalid method returns 422 here and we stay on the form (no code sent).
  async function sendCode(): Promise<boolean> {
    const res = await apiSend<{ maskedEmail: string; ttlMinutes: number }>('POST', '/api/payouts/method/challenge', form())
    setMaskedEmail(res.maskedEmail)
    return Boolean(res.maskedEmail)
  }

  // Validate, email a verification code, and move to the code step.
  async function requestCode() {
    if (!valid || saving) return
    setSaving(true)
    setError('')
    try {
      await sendCode()
      setPhase('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a verification code.')
    } finally {
      setSaving(false)
    }
  }

  async function resendCode() {
    if (saving) return
    setSaving(true)
    setError('')
    setResent(false)
    try {
      await sendCode()
      setResent(true)
      setTimeout(() => setResent(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a verification code.')
    } finally {
      setSaving(false)
    }
  }

  // Confirm the emailed code and persist the change.
  async function handleConfirm() {
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6 || saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(form(), clean)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the payment method.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between sm:mb-5">
          <h2 className="text-lg font-semibold text-slate-900">{initial ? 'Edit payment method' : 'Add payment method'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        {phase === 'verify' ? (
          <div>
            <p className="text-sm text-slate-500">
              For your security, enter the 6-digit code we emailed
              {maskedEmail ? (
                <>
                  {' '}
                  to <span className="font-medium text-slate-700">{maskedEmail}</span>
                </>
              ) : (
                ' to your address'
              )}
              .
            </p>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm()
              }}
              placeholder="123456"
              className={`${field} mt-4 text-center font-mono text-lg tracking-[0.3em]`}
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={resendCode}
                disabled={saving}
                className="font-medium text-brand-fuchsia transition-colors hover:text-brand-violet disabled:opacity-50"
              >
                Resend code
              </button>
              {resent && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Check size={13} /> Sent
                </span>
              )}
            </div>
            {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setPhase('form')
                  setError('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={code.replace(/\D/g, '').length !== 6 || saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-fuchsia px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <LoaderCircle size={16} className="animate-spin" />}
                {saving ? 'Saving...' : 'Confirm & save'}
              </button>
            </div>
          </div>
        ) : (
          <>
        {initial && (
          <p className="-mt-2 mb-4 text-xs text-slate-400">
            Current destination: <span className="font-medium text-slate-500">{initial.preview}</span> — saving replaces it.
          </p>
        )}

        {/* Type selector */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          {METHODS.map((m) => {
            const on = method === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`relative flex min-h-[72px] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all sm:min-h-[120px] sm:flex-col sm:gap-2 sm:py-4 sm:text-center ${
                  on ? 'border-brand-fuchsia bg-brand-fuchsia/5 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {on && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-fuchsia sm:right-2 sm:top-2 sm:translate-y-0" />}
                <span className="grid h-12 w-12 shrink-0 place-items-center">
                  <img src={m.image} alt={`${m.label} logo`} className="h-10 w-10 object-contain" />
                </span>
                <span className="min-w-0 flex-1 pr-7 sm:pr-0">
                  <span className={`block text-sm font-semibold leading-5 ${on ? 'text-brand-fuchsia' : 'text-slate-700'}`}>
                    {m.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400">{m.hint}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Fields */}
        <div className="mt-5 min-h-[128px] sm:min-h-[112px]">
          {method === 'binance' && (
            <>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Binance Pay ID</label>
              <input value={binanceId} onChange={(e) => setBinanceId(e.target.value)} placeholder="e.g. 123456789" className={`${field} font-mono`} />
              <p className="mt-1.5 text-xs text-slate-400">Find this in Binance - Pay - My profile.</p>
            </>
          )}

          {method === 'usdt' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">USDT Wallet Address</label>
                <div className="relative">
                  <input
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="T..."
                    className={`${field} pr-28 font-mono`}
                  />
                  {/* Network selector at the end of the input — defaults to TRC20 (Tron).
                      z-50 on this wrapper lifts its (transform-created) stacking context
                      above the modal footer so the open menu isn't covered. */}
                  <div className="absolute right-1.5 top-1/2 z-50 -translate-y-1/2">
                    <button
                      type="button"
                      onClick={() => setNetworkOpen((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      {network.split(' ')[0]}
                      <ChevronDown size={13} className={`text-slate-400 transition-transform ${networkOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {networkOpen && (
                      <>
                        <button
                          type="button"
                          aria-hidden
                          tabIndex={-1}
                          onClick={() => setNetworkOpen(false)}
                          className="fixed inset-0 z-40 cursor-default"
                        />
                        <div className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                          {NETWORKS.map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                setNetwork(n)
                                setNetworkOpen(false)
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 ${
                                network === n ? 'font-semibold text-brand-fuchsia' : 'text-slate-600'
                              }`}
                            >
                              {n}
                              {network === n && <Check size={14} className="shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-400">Double-check the address - crypto payments can't be reversed.</p>
            </div>
          )}

          {method === 'paypal' && (
            <>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">PayPal email</label>
              <input type="email" value={paypal} onChange={(e) => setPaypal(e.target.value)} placeholder="you@example.com" className={field} />
              <p className="mt-1.5 text-xs text-slate-400">Use the email tied to your PayPal account.</p>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={requestCode}
            disabled={!valid || saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-fuchsia px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            {saving ? 'Sending…' : 'Continue'}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  )
}

function PaymentMethodSection({
  saved,
  loading,
  onSave,
}: {
  saved: SavedMethod | null
  loading: boolean
  onSave: (m: MethodForm, code: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const meta = saved && methodMeta(saved.method)

  return (
    <>
      {loading ? (
        <div className={`${CARD} flex items-center gap-4 p-5`}>
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ) : saved && meta ? (
        <div className={`${CARD} flex items-center gap-4 p-5`}>
          <span className="grid h-12 w-12 shrink-0 place-items-center">
            <img src={meta.image} alt={`${meta.label} logo`} className="h-10 w-10 object-contain" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-medium text-slate-900">
              {meta.label}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 size={11} /> Active
              </span>
            </p>
            <p className="truncate text-sm text-slate-500">{summarize(saved)}</p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Edit
          </button>
        </div>
      ) : (
        <div className={`${CARD} flex flex-col items-center justify-center gap-3 border-dashed py-12 text-center`}>
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-fuchsia/10 text-brand-fuchsia">
            <Wallet size={24} />
          </span>
          <p className="font-medium text-slate-900">No payment method yet</p>
          <p className="max-w-sm text-sm text-slate-500">Add a method so we know where to send your payments.</p>
          <button
            onClick={() => setOpen(true)}
            className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90"
          >
            <Plus size={18} />
            Add payment method
          </button>
        </div>
      )}

      {open && <PaymentMethodModal initial={saved} onClose={() => setOpen(false)} onSave={onSave} />}
    </>
  )
}

const STATUS: Record<string, { tone: string; icon: Icon }> = {
  Paid: { tone: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
  Processing: { tone: 'bg-blue-50 text-blue-600', icon: RefreshCw },
  Scheduled: { tone: 'bg-amber-50 text-amber-600', icon: Clock },
  Cancelled: { tone: 'bg-slate-100 text-slate-500', icon: X },
}

const INVOICE_FILTERS = ['all', 'Scheduled', 'Processing', 'Paid'] as const
type InvoiceFilter = (typeof INVOICE_FILTERS)[number]

export default function Payment() {
  const payouts = useCachedSection<PaymentData>({
    key: 'payouts.list',
    ttl: CACHE_TTL['payouts.list'],
    fetcher: (signal) => apiGet('/api/payouts', { signal }),
  })
  const d = payouts.data
  const { publisher } = useAuth()
  const biller: Biller = { name: publisher?.name, company: publisher?.companyName, email: publisher?.email }
  // Optimistic override so a saved method shows instantly, before the refetch.
  const [methodOverride, setMethodOverride] = useState<SavedMethod | null>(null)
  const savedMethod = methodOverride ?? d?.method ?? null
  const [filter, setFilter] = useState<InvoiceFilter>('all')
  // Invoice shown in the detail modal (gross / chargebacks / net breakdown).
  const [selected, setSelected] = useState<InvoiceRow | null>(null)

  async function saveMethod(m: MethodForm, code: string) {
    const res = await apiSend<{ method: SavedMethod }>('PUT', '/api/payouts/method', { ...m, code })
    setMethodOverride(res.method)
    payouts.refetch()
  }

  // "Awaiting payment" = invoices not yet paid/cancelled — derived from the
  // invoices the API already returns (no extra request, no API change).
  const awaiting = useMemo(
    () => (d ? d.invoices.filter((i) => i.status === 'Scheduled' || i.status === 'Processing').reduce((s, i) => s + i.amount, 0) : 0),
    [d],
  )

  const invoiceCounts = useMemo(() => {
    const c: Record<string, number> = { all: d?.invoices.length ?? 0, Scheduled: 0, Processing: 0, Paid: 0 }
    d?.invoices.forEach((i) => {
      if (i.status in c) c[i.status] += 1
    })
    return c
  }, [d])

  const shownInvoices = useMemo(
    () => (!d ? [] : filter === 'all' ? d.invoices : d.invoices.filter((i) => i.status === filter)),
    [d, filter],
  )

  const stats = [
    { label: 'Current period', value: d ? usd(d.stats.currentPeriod) : '', icon: TrendingUp, tile: 'bg-blue-50 text-blue-600' },
    { label: 'Awaiting payment', value: d ? usd(awaiting) : '', icon: HourglassIcon, tile: 'bg-amber-50 text-amber-600' },
    { label: 'Next payout', value: d ? fmtDate(d.stats.nextPayoutDate) : '', icon: Clock, tile: 'bg-violet-50 text-violet-600' },
    { label: 'Lifetime paid', value: d ? usd(d.stats.lifetimePaid) : '', icon: DollarSign, tile: 'bg-emerald-50 text-emerald-600' },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-slate-900">
            Payment
            {payouts.isRefreshing && <InlineSpinner className="h-4 w-4" />}
          </h1>
          <p className="mt-1 text-slate-500">Your balance, payment method, and invoices.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600">
          <Wallet size={15} className="text-brand-fuchsia" />
          $20 minimum payout
        </span>
      </div>

      {payouts.error && !d && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {payouts.error}{' '}
          <button type="button" onClick={payouts.refetch} className="font-semibold text-red-700">
            Retry
          </button>
        </p>
      )}

      {/* Balance hero — balance + when/where the next payment goes */}
      <div className={`${CARD} relative overflow-hidden p-6`}>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-brand-violet/15 to-brand-fuchsia/15 blur-2xl" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Wallet size={18} className="text-brand-fuchsia" />
            Available balance
          </div>
          <span className="rounded-full bg-brand-fuchsia/10 px-2.5 py-1 text-xs font-semibold text-brand-fuchsia" title="Paid 30 days after each monthly close.">
            Net 30
          </span>
        </div>
        <p className="mt-2 font-display text-4xl font-bold tracking-tight tabular-nums text-slate-900">
          {d ? usd(d.balance) : <InlineSpinner className="my-2" />}
        </p>
        {d && (
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm sm:flex-row sm:items-center sm:gap-6">
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <Clock size={15} className="text-slate-400" />
              Next payout <span className="font-medium text-slate-700">{fmtDate(d.stats.nextPayoutDate)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <Wallet size={15} className="text-slate-400" />
              {savedMethod ? (
                <>to <span className="font-medium text-slate-700">{summarize(savedMethod)}</span></>
              ) : (
                <span className="font-medium text-amber-600">Add a payment method to get paid</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tile }) => (
          <div key={label} className={`${CARD} p-5`}>
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${tile}`}>
              <Icon size={20} />
            </span>
            <p className="mt-4 text-sm text-slate-500">{label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
              {value || <InlineSpinner className="my-1" />}
            </p>
          </div>
        ))}
      </div>

      {/* Payment method */}
      <h2 className="mb-4 mt-8 font-semibold text-slate-900">Payment method</h2>
      <PaymentMethodSection saved={savedMethod} loading={payouts.isLoading} onSave={saveMethod} />

      {/* Invoices */}
      <div className={`mt-8 ${CARD}`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-semibold text-slate-900">Invoices</h2>
            <p className="mt-0.5 text-sm text-slate-500">Generated by AsyncAds at each monthly close.</p>
          </div>
          {/* Status filter */}
          {d && d.invoices.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {INVOICE_FILTERS.map((f) => {
                const on = filter === f
                const label = f === 'all' ? 'All' : f
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      on ? 'border-brand-fuchsia bg-brand-fuchsia/10 text-brand-fuchsia' : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                    <span className={`rounded-full px-1.5 text-[10px] ${on ? 'bg-brand-fuchsia/15 text-brand-fuchsia' : 'bg-slate-100 text-slate-400'}`}>
                      {invoiceCounts[f] ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Column headers (desktop only) */}
        <div className="hidden grid-cols-12 gap-4 border-b border-slate-100 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:grid">
          <span className="col-span-3">Invoice</span>
          <span className="col-span-3">Period</span>
          <span className="col-span-2">Issued</span>
          <span className="col-span-2 text-right">Amount</span>
          <span className="col-span-2 text-right">Status</span>
        </div>

        {payouts.isLoading ? (
          <p className="flex items-center gap-2 px-6 py-10 text-sm text-slate-400">
            <InlineSpinner /> Loading invoices…
          </p>
        ) : !d || d.invoices.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No invoices yet.</p>
        ) : shownInvoices.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No {filter.toLowerCase()} invoices.</p>
        ) : (
          shownInvoices.map((inv) => {
            const s = STATUS[inv.status] ?? STATUS.Scheduled
            const hasChargeback = inv.chargebacks > 0
            const download = (
              <button
                type="button"
                aria-label={`Download ${inv.number}`}
                title="Download invoice"
                onClick={(e) => {
                  e.stopPropagation()
                  downloadInvoice(inv, biller)
                }}
                className="text-slate-300 transition-colors hover:text-brand-fuchsia"
              >
                <Download size={16} />
              </button>
            )
            const badge = (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.tone}`}>
                <s.icon size={12} />
                {inv.status}
              </span>
            )
            const chargebackChip = hasChargeback && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600" title="Chargebacks deducted this period">
                −{usd(inv.chargebacks)}
              </span>
            )
            const chevron = <ChevronRight size={15} className="shrink-0 text-slate-300" />
            return (
              <div key={inv.number} className="border-b border-slate-100 last:border-0">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`View invoice ${inv.number}`}
                  onClick={() => setSelected(inv)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(inv)
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-slate-50/70"
                >
                  {/* Mobile: stacked card */}
                  <div className="flex items-start justify-between gap-3 px-5 py-4 sm:hidden">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {download}
                        <span className="font-mono text-sm text-slate-700">{inv.number}</span>
                        {chevron}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {fmtPeriod(inv.periodStart)} · Issued {fmtDate(inv.issuedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-semibold tabular-nums text-slate-900">{usd(inv.amount)}</span>
                      {chargebackChip}
                      {badge}
                    </div>
                  </div>

                  {/* Desktop: table row */}
                  <div className="hidden grid-cols-12 items-center gap-4 px-6 py-4 sm:grid">
                    <span className="col-span-3 flex items-center gap-2">
                      {download}
                      <span className="font-mono text-sm text-slate-700">{inv.number}</span>
                      {chevron}
                    </span>
                    <span className="col-span-3 text-sm text-slate-600">{fmtPeriod(inv.periodStart)}</span>
                    <span className="col-span-2 text-sm text-slate-600">{fmtDate(inv.issuedAt)}</span>
                    <span className="col-span-2 flex items-center justify-end gap-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                      {chargebackChip}
                      {usd(inv.amount)}
                    </span>
                    <span className="col-span-2 flex justify-end">{badge}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {selected && (
        <InvoiceModal invoice={selected} onClose={() => setSelected(null)} onDownload={() => downloadInvoice(selected, biller)} />
      )}
    </div>
  )
}

function InvoiceModal({ invoice, onClose, onDownload }: { invoice: InvoiceRow; onClose: () => void; onDownload: () => void }) {
  const s = STATUS[invoice.status] ?? STATUS.Scheduled
  const hasChargeback = invoice.chargebacks > 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="font-mono text-sm font-semibold text-slate-900">{invoice.number}</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {fmtPeriod(invoice.periodStart)} · Issued {fmtDate(invoice.issuedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.tone}`}>
              <s.icon size={12} />
              {invoice.status}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 sm:px-6">
          <dl className="divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-slate-500">Gross earnings</dt>
              <dd className="font-semibold tabular-nums text-slate-700">{usd(invoice.gross)}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="flex items-center gap-1.5 text-slate-500">
                Chargebacks
                {hasChargeback && <span className="rounded-full bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-600">reversed</span>}
              </dt>
              <dd className={`font-semibold tabular-nums ${hasChargeback ? 'text-rose-600' : 'text-slate-400'}`}>
                {hasChargeback ? `−${usd(invoice.chargebacks)}` : usd(0)}
              </dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="font-medium text-slate-900">Net paid</dt>
              <dd className="font-display text-lg font-bold tabular-nums text-slate-900">{usd(invoice.amount)}</dd>
            </div>
          </dl>

          <p className="mt-2 text-xs text-slate-400">
            {hasChargeback
              ? 'Chargebacks are conversions reversed after the sale (refunds/disputes), deducted from this invoice.'
              : 'No chargebacks were deducted from this invoice.'}
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Download size={16} /> Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-brand-fuchsia px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-fuchsia/90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

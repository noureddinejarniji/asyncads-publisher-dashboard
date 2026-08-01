import { memo, useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Building2, Check, Clock, Copy, Globe, KeyRound, LoaderCircle, LogOut, Mail, MapPin, Monitor, ShieldCheck, Smartphone, TriangleAlert, User, X } from 'lucide-react'

import {
  listSessions,
  logoutOtherSessions,
  revokeSession,
  requestSessionRemovalCode,
  changePassword,
  apiGet,
  apiSend,
  type BrowserSession,
  type Publisher,
} from '../lib/auth'
import { useAuth } from '../lib/AuthContext'
import { useAppDispatch } from '../store'
import { invalidateByPrefix } from '../store/cacheSlice'
import { useCachedSection } from '../store/useCachedSection'
import { CACHE_TTL } from '../store/cache'

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'
const field =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20'
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700'

/** Title-cases the local part of an email into a display name. */
function displayNameFromEmail(email: string) {
  const name = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  if (!name) return 'Publisher'
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Formats an ISO timestamp the way the sessions list reads best: "Just now",
 * "Today at 3:18 PM", "Yesterday at 3:18 PM", or "Apr 2 at 3:18 PM" for older.
 */
function formatLastActive(iso: string | null): string {
  if (!iso) return 'Last active unknown'
  const d = new Date(iso)
  const then = d.getTime()
  if (Number.isNaN(then)) return 'Last active unknown'

  const diffMin = Math.floor((Date.now() - then) / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`

  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const dayDiff = Math.floor((startOfToday.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  if (dayDiff <= 0) return `Today at ${time}`
  if (dayDiff === 1) return `Yesterday at ${time}`
  if (dayDiff < 7) return `${d.toLocaleDateString(undefined, { weekday: 'long' })} at ${time}`
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`
}

// Stable accent palette so every session gets its own recognizable color chip.
const SESSION_ACCENTS = [
  'bg-sky-100 text-sky-600',
  'bg-violet-100 text-violet-600',
  'bg-amber-100 text-amber-600',
  'bg-rose-100 text-rose-600',
  'bg-teal-100 text-teal-600',
  'bg-indigo-100 text-indigo-600',
]

const Switch = memo(function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
})

const SectionHeader = memo(function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-semibold text-slate-900 text-lg">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  )
})

type ToggleKey = 'reports' | 'payouts' | 'promotions' | 'product'
type Toggles = Record<ToggleKey, boolean>
type TwoFactorSetup = { method: 'app' | 'email'; secret?: string; otpauthUrl?: string; maskedEmail?: string }

const NOTIFICATIONS: { key: ToggleKey; label: string; description: string }[] = [
  { key: 'reports', label: 'Weekly performance reports', description: 'A summary of revenue, conversions, and eCPM every Monday.' },
  { key: 'payouts', label: 'Payout confirmations', description: 'Get notified when a payout is sent to your account.' },
  { key: 'promotions', label: 'Promotion approvals', description: 'Updates when a promotion is approved or needs changes.' },
  { key: 'product', label: 'Product updates', description: 'Occasional news about new AsyncAds features.' },
]

type SessionRemovalTarget = { kind: 'revoke'; id: number } | { kind: 'others' }

/**
 * Code-gated confirmation for removing a browser session. On open it emails a
 * one-time code to the account address; the removal only proceeds once the user
 * enters that code. Used for both single-session revoke and "sign out others".
 */
function SessionRemovalModal({
  target,
  onClose,
  onDone,
}: {
  target: SessionRemovalTarget
  onClose: () => void
  onDone: () => void
}) {
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(true)
  const [resent, setResent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Send a code as soon as the modal opens.
  useEffect(() => {
    let active = true
    requestSessionRemovalCode()
      .then((res) => {
        if (!active) return
        setMaskedEmail(res.maskedEmail)
        setError('')
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to send a code.')
      })
      .finally(() => {
        if (active) setSending(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function resend() {
    setError('')
    setResent(false)
    setSending(true)
    try {
      const res = await requestSessionRemovalCode()
      setMaskedEmail(res.maskedEmail)
      setResent(true)
      setTimeout(() => setResent(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a code.')
    } finally {
      setSending(false)
    }
  }

  async function submit() {
    const clean = code.replace(/\D/g, '')
    if (clean.length !== 6 || submitting) return
    setSubmitting(true)
    setError('')
    try {
      if (target.kind === 'revoke') await revokeSession(target.id, clean)
      else await logoutOtherSessions(clean)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove the session.')
    } finally {
      setSubmitting(false)
    }
  }

  const ready = code.replace(/\D/g, '').length === 6
  const title = target.kind === 'others' ? 'Sign out other sessions' : 'Remove this session'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-fuchsia/10 text-brand-fuchsia">
              <ShieldCheck size={20} />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">
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
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <label className={labelClass}>Verification code</label>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="123456"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-slate-900 placeholder:tracking-normal placeholder:text-slate-400 focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
        />

        <div className="mt-2 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="font-medium text-brand-fuchsia transition-colors hover:text-brand-violet disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Resend code'}
          </button>
          {resent && (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <Check size={13} /> Sent
            </span>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

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
            onClick={submit}
            disabled={!ready || submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <LoaderCircle size={16} className="animate-spin" />}
            {target.kind === 'others' ? 'Sign out others' : 'Remove session'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const dispatch = useAppDispatch()
  const { publisher, signOut, updatePublisher } = useAuth()
  const email = publisher?.email ?? ''

  const [name, setName] = useState(() => publisher?.name?.trim() || displayNameFromEmail(email))
  const [company, setCompany] = useState(publisher?.companyName ?? '')
  const [website, setWebsite] = useState(publisher?.websiteUrl ?? '')

  // Load notification preferences via cache
  const notifications = useCachedSection<Toggles>({
    key: 'settings',
    params: { section: 'notifications' },
    ttl: CACHE_TTL.settings,
    fetcher: (signal) => apiGet<Toggles>('/api/settings/notifications', { signal }),
  })

  const [toggles, setToggles] = useState<Toggles>({
    reports: true,
    payouts: true,
    promotions: true,
    product: false,
  })

  // Sync preferences state when (re)loaded — adjusted during render.
  const [syncedToggles, setSyncedToggles] = useState<Toggles | null>(null)
  if (notifications.data && notifications.data !== syncedToggles) {
    setSyncedToggles(notifications.data)
    setToggles(notifications.data)
  }

  const toggle = (key: ToggleKey) => setToggles((t) => ({ ...t, [key]: !t[key] }))

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorPassword, setTwoFactorPassword] = useState('')
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState('')
  const [twoFactorSaved, setTwoFactorSaved] = useState('')
  const twoFactorEnabled = Boolean(publisher?.twoFactorEnabled)
  const twoFactorMethod = publisher?.twoFactorMethod ?? 'app'

  // Browser sessions.
  const [sessions, setSessions] = useState<BrowserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [sessionsError, setSessionsError] = useState('')
  // Removing a session requires an emailed code; this holds the pending target
  // while the code-entry modal is open.
  const [removalTarget, setRemovalTarget] = useState<SessionRemovalTarget | null>(null)

  // All state updates happen in promise callbacks — sessionsLoading starts
  // true and later reloads refresh the list silently.
  function loadSessions() {
    return listSessions()
      .then((list) => {
        setSessions(list)
        setSessionsError('')
      })
      .catch((err: unknown) => {
        setSessionsError(err instanceof Error ? err.message : 'Unable to load sessions.')
      })
      .finally(() => setSessionsLoading(false))
  }

  useEffect(() => {
    loadSessions()
  }, [])

  // Both removals are code-gated: open the modal with the pending target. The
  // modal emails the code and performs the removal once it's verified.
  function handleLogoutOthers() {
    setSessionsError('')
    setRemovalTarget({ kind: 'others' })
  }

  function handleRevoke(id: number) {
    setSessionsError('')
    setRemovalTarget({ kind: 'revoke', id })
  }

  const [loggingOut, setLoggingOut] = useState(false)
  async function handleLogout() {
    setLoggingOut(true)
    try {
      // Signs out the current device; AuthContext flips to unauthenticated and
      // redirects to the login screen, so there's nothing to reset on success.
      await signOut()
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : 'Unable to log out.')
      setLoggingOut(false)
    }
  }

  const otherCount = sessions.filter((s) => !s.isCurrent).length

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      // 1. Save profile updates to the database
      const profileRes = await apiSend<{ publisher: { name: string; companyName: string | null; websiteUrl: string | null } }>('PATCH', '/api/settings/profile', {
        name,
        companyName: company,
        websiteUrl: website,
      })

      // Reflect the saved profile in auth state (kept in memory, not persisted).
      if (profileRes.publisher) {
        updatePublisher(profileRes.publisher)
      }

      // 2. Save notification toggles to the database
      await apiSend('PUT', '/api/settings/notifications', toggles)

      // Invalidate caches to refresh across layout and dashboard views
      dispatch(invalidateByPrefix('settings'))
      dispatch(invalidateByPrefix('dashboard.'))

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'P'
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw
  const canChangePw =
    currentPw.length > 0 && newPw.length >= 8 && newPw === confirmPw && newPw !== currentPw

  async function handleChangePassword() {
    setPwError('')
    if (!currentPw) {
      setPwError('Enter your current password.')
      return
    }
    if (newPw.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords don’t match.')
      return
    }
    if (newPw === currentPw) {
      setPwError('New password must be different from the current one.')
      return
    }
    setPwSaving(true)
    try {
      await changePassword(currentPw, newPw)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2500)
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Unable to change password.')
    } finally {
      setPwSaving(false)
    }
  }

  async function startTwoFactorSetup(method: 'app' | 'email') {
    setTwoFactorError('')
    setTwoFactorSaved('')
    setTwoFactorBusy(true)
    try {
      const setup = await apiSend<TwoFactorSetup>('POST', '/api/auth/publisher/2fa/setup', { method })
      setTwoFactorSetup({ ...setup, method })
      setTwoFactorCode('')
      setTwoFactorPassword('')
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Unable to start two-factor setup.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  /** Sends a fresh email code (resend during email setup, or before disabling). */
  async function sendEmailCode() {
    setTwoFactorError('')
    setTwoFactorSaved('')
    setTwoFactorBusy(true)
    try {
      await apiSend('POST', '/api/auth/publisher/2fa/send-code')
      setTwoFactorSaved('A new code is on its way.')
      setTimeout(() => setTwoFactorSaved(''), 2500)
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Unable to send a code.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function confirmTwoFactor() {
    const code = twoFactorCode.replace(/\D/g, '')
    setTwoFactorError('')
    setTwoFactorSaved('')
    if (code.length !== 6) {
      setTwoFactorError('Enter the 6-digit verification code.')
      return
    }

    setTwoFactorBusy(true)
    try {
      const res = await apiSend<{ ok: boolean; publisher: Partial<Publisher> }>(
        'POST',
        '/api/auth/publisher/2fa/confirm',
        { code },
      )
      updatePublisher(res.publisher)
      setTwoFactorSetup(null)
      setTwoFactorCode('')
      setTwoFactorPassword('')
      setTwoFactorSaved('Two-factor authentication enabled.')
      setTimeout(() => setTwoFactorSaved(''), 2500)
      await loadSessions()
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Unable to enable two-factor authentication.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function disableTwoFactor() {
    const code = twoFactorCode.replace(/\D/g, '')
    setTwoFactorError('')
    setTwoFactorSaved('')
    if (!twoFactorPassword) {
      setTwoFactorError('Enter your current password.')
      return
    }
    if (code.length !== 6) {
      setTwoFactorError(
        twoFactorMethod === 'email'
          ? 'Enter the 6-digit code from your email.'
          : 'Enter the 6-digit code from your authenticator app.',
      )
      return
    }

    setTwoFactorBusy(true)
    try {
      const res = await apiSend<{ ok: boolean; publisher: Partial<Publisher> }>(
        'DELETE',
        '/api/auth/publisher/2fa',
        { password: twoFactorPassword, code },
      )
      updatePublisher(res.publisher)
      setTwoFactorSetup(null)
      setTwoFactorCode('')
      setTwoFactorPassword('')
      setTwoFactorSaved('Two-factor authentication disabled.')
      setTimeout(() => setTwoFactorSaved(''), 2500)
      await loadSessions()
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Unable to disable two-factor authentication.')
    } finally {
      setTwoFactorBusy(false)
    }
  }

  async function copyTwoFactorSecret() {
    if (!twoFactorSetup?.secret) return
    try {
      await navigator.clipboard.writeText(twoFactorSetup.secret)
      setTwoFactorSaved('Setup key copied.')
      setTimeout(() => setTwoFactorSaved(''), 1800)
    } catch {
      setTwoFactorError('Unable to copy the setup key.')
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-slate-500">Manage your profile, notifications, and account security.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-brand-fuchsia px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-fuchsia/90 disabled:opacity-50"
        >
          {saving && <LoaderCircle size={16} className="animate-spin" />}
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Profile */}
        <div id="profile" className={`${CARD} scroll-mt-6 overflow-hidden`}>
          {/* Cover Banner */}
          <div className="h-32 w-full bg-gradient-to-r from-brand-violet/20 via-brand-fuchsia/15 to-slate-50 border-b border-slate-100" />
          
          <div className="px-6 pb-6">
            {/* Avatar block with overlap */}
            <div className="relative -mt-10 mb-6">
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-fuchsia text-2xl font-bold text-white shadow-md shadow-brand-fuchsia/20 ring-4 ring-white">
                {initials}
              </span>
            </div>

            <div className="mb-5">
              <h2 className="font-semibold text-slate-900 text-lg">Profile Settings</h2>
              <p className="text-sm text-slate-500">Update your personal details and business credentials.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Display name</label>
                <div className="relative">
                  <User size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={`${field} pl-10 focus:border-brand-fuchsia focus:ring-4 focus:ring-brand-fuchsia/10`}
                  />
                </div>
              </div>
              
              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={email}
                    readOnly
                    className={`${field} cursor-not-allowed pl-10 pr-36 text-slate-500 bg-slate-50/70`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100 shadow-sm">
                    <Check size={11} /> Verified
                  </span>
                </div>
              </div>
              
              <div>
                <label className={labelClass}>Company Name</label>
                <div className="relative">
                  <Building2 size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Inc."
                    className={`${field} pl-10 focus:border-brand-fuchsia focus:ring-4 focus:ring-brand-fuchsia/10`}
                  />
                </div>
              </div>
              
              <div>
                <label className={labelClass}>Website URL</label>
                <div className="relative">
                  <Globe size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className={`${field} pl-10 font-mono focus:border-brand-fuchsia focus:ring-4 focus:ring-brand-fuchsia/10`}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className={labelClass}>API Key</label>
                <div className="relative">
                  <KeyRound size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value="••••••••••••••••••••••••"
                    readOnly
                    disabled
                    aria-label="API key (coming soon)"
                    className={`${field} cursor-not-allowed pl-10 pr-32 font-mono text-slate-400 bg-slate-50/70`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-100 shadow-sm">
                    Coming soon
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">Use this key to fetch offers programmatically from the AsyncAds API. Available in a future update.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div id="notifications" className={`${CARD} scroll-mt-6 p-6`}>
          <SectionHeader title="Notifications" subtitle="Choose which emails AsyncAds sends you." />
          <div className="divide-y divide-slate-100">
            {NOTIFICATIONS.map((n) => (
              <div key={n.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{n.label}</p>
                  <p className="text-sm text-slate-500">{n.description}</p>
                </div>
                <Switch on={toggles[n.key]} onChange={() => toggle(n.key)} />
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div id="security" className={`${CARD} scroll-mt-6 p-6`}>
          <SectionHeader title="Security" subtitle="Update your password and review two-factor settings." />

          {pwError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pwError}</p>
          )}
          {pwSaved && (
            <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
              <Check size={16} /> Password updated. Other browser sessions have been signed out.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Current password</label>
              <input type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="••••••••" className={field} />
            </div>
            <div>
              <label className={labelClass}>New password</label>
              <input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••" className={field} />
              <p className="mt-1.5 text-xs text-slate-400">At least 8 characters.</p>
            </div>
            <div>
              <label className={labelClass}>Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className={`${field} ${pwMismatch ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
              />
              {pwMismatch && <p className="mt-1.5 text-xs text-red-500">Passwords don’t match.</p>}
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={!canChangePw || pwSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pwSaving && <LoaderCircle size={16} className="animate-spin" />}
              Update Password
            </button>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            {twoFactorError && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {twoFactorError}
              </p>
            )}
            {twoFactorSaved && (
              <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
                <Check size={16} /> {twoFactorSaved}
              </p>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${twoFactorEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  <ShieldCheck size={20} />
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                    Two-factor authentication
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${twoFactorEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {twoFactorEnabled ? 'Enabled' : 'Off'}
                    </span>
                  </p>
                  <p className="text-sm text-slate-500">Require a one-time code at sign-in for extra security.</p>
                </div>
              </div>

              {!twoFactorEnabled && !twoFactorSetup && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => startTwoFactorSetup('app')}
                    disabled={twoFactorBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ShieldCheck size={16} /> Authenticator app
                  </button>
                  <button
                    type="button"
                    onClick={() => startTwoFactorSetup('email')}
                    disabled={twoFactorBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Mail size={16} /> Email code
                  </button>
                </div>
              )}
            </div>

            {!twoFactorEnabled && twoFactorSetup && (
              <div className="mt-5 space-y-4">
                {twoFactorSetup.method === 'email' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600">
                    We emailed a 6-digit code to{' '}
                    <span className="font-medium text-slate-800">{twoFactorSetup.maskedEmail ?? 'your email'}</span>. Enter it
                    below to turn on email verification.
                    <button
                      type="button"
                      onClick={sendEmailCode}
                      disabled={twoFactorBusy}
                      className="ml-1 font-medium text-brand-fuchsia transition-colors hover:text-brand-violet disabled:opacity-60"
                    >
                      Resend
                    </button>
                  </div>
                ) : (
                  <div>
                    {twoFactorSetup.otpauthUrl && (
                      <div className="mb-4 flex flex-col items-center gap-2">
                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <QRCodeSVG value={twoFactorSetup.otpauthUrl} size={176} level="M" includeMargin={false} />
                        </div>
                        <p className="text-xs text-slate-400">Scan this with your authenticator app</p>
                      </div>
                    )}
                    <label className={labelClass}>Or enter this setup key manually</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <code className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-800 break-all">
                        {twoFactorSetup.secret}
                      </code>
                      <button
                        type="button"
                        onClick={copyTwoFactorSecret}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                      >
                        <Copy size={16} /> Copy
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">After adding it, confirm the current 6-digit code below.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <div>
                    <label className={labelClass}>{twoFactorSetup.method === 'email' ? 'Email code' : 'Authenticator code'}</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className={`${field} font-mono tracking-[0.25em]`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={confirmTwoFactor}
                    disabled={twoFactorBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {twoFactorBusy && <LoaderCircle size={16} className="animate-spin" />}
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorSetup(null)
                      setTwoFactorCode('')
                      setTwoFactorError('')
                    }}
                    disabled={twoFactorBusy}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {twoFactorEnabled && (
              <div className="mt-5 space-y-2">
                <p className="text-xs text-slate-400">
                  Active method: <span className="font-medium text-slate-600">{twoFactorMethod === 'email' ? 'Email code' : 'Authenticator app'}</span>.
                  {twoFactorMethod === 'email' && ' Send yourself a code, then enter it to disable.'}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                  <div>
                    <label className={labelClass}>Current password</label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={twoFactorPassword}
                      onChange={(e) => setTwoFactorPassword(e.target.value)}
                      placeholder="Password"
                      className={field}
                    />
                  </div>
                  <div>
                    <label className={`${labelClass} flex items-center justify-between`}>
                      <span>{twoFactorMethod === 'email' ? 'Email code' : '2FA code'}</span>
                      {twoFactorMethod === 'email' && (
                        <button
                          type="button"
                          onClick={sendEmailCode}
                          disabled={twoFactorBusy}
                          className="text-xs font-medium text-brand-fuchsia transition-colors hover:text-brand-violet disabled:opacity-60"
                        >
                          Send code
                        </button>
                      )}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className={`${field} font-mono tracking-[0.25em]`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={disableTwoFactor}
                    disabled={twoFactorBusy}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {twoFactorBusy && <LoaderCircle size={16} className="animate-spin" />}
                    Disable 2FA
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Browser sessions */}
        <div id="sessions" className={`${CARD} scroll-mt-6 p-6`}>
          <SectionHeader
            title="Browser Sessions"
            subtitle="Devices and browsers where you're currently signed in."
          />

          {sessionsError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {sessionsError}
            </p>
          )}

          {sessionsLoading ? (
            <div className="space-y-2">
              {[0, 1].map((n) => (
                <div key={n} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                  <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <span className="block h-3.5 w-32 animate-pulse rounded bg-slate-100" />
                    <span className="block h-3 w-44 animate-pulse rounded bg-slate-100" />
                    <span className="block h-3 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400">
                <Monitor size={22} />
              </span>
              <p className="text-sm font-medium text-slate-600">No active sessions</p>
              <p className="text-xs text-slate-400">Devices you sign in with will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => {
                const isMobile = s.osName === 'Android' || s.osName === 'iOS'
                const DeviceIcon = isMobile ? Smartphone : Monitor
                const title = s.deviceName || [s.osName, s.browserName].filter(Boolean).join(' - ') || 'Unknown device'
                const meta = [s.browserName, s.osName].filter(Boolean).join(' · ')
                const accent = s.isCurrent
                  ? 'bg-emerald-100 text-emerald-600'
                  : SESSION_ACCENTS[i % SESSION_ACCENTS.length]
                return (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      s.isCurrent
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent}`}>
                      <DeviceIcon size={20} />
                      {s.isCurrent && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium text-slate-900">
                        <span className="truncate">{title}</span>
                        {s.isCurrent && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            This device
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-500">
                        <MapPin size={13} className="shrink-0 text-slate-400" />
                        {s.location || s.ipAddress || 'Location unknown'}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} className="shrink-0" />
                          {s.isCurrent ? 'Active now' : formatLastActive(s.lastUsedAt)}
                        </span>
                        {meta && (
                          <>
                            <span aria-hidden className="text-slate-300">•</span>
                            <span className="truncate">{meta}</span>
                          </>
                        )}
                      </p>
                    </div>
                    {s.isCurrent ? (
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loggingOut ? <LoaderCircle size={14} className="animate-spin" /> : <LogOut size={14} />}
                        Log out
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRevoke(s.id)}
                        aria-label="Revoke session"
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <p className="text-xs text-slate-400">
              {otherCount > 0
                ? `${otherCount} other ${otherCount === 1 ? 'session' : 'sessions'} signed in.`
                : 'No other sessions signed in.'}
            </p>
            <button
              type="button"
              onClick={handleLogoutOthers}
              disabled={otherCount === 0}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700"
            >
              <LogOut size={15} />
              Log out other sessions
            </button>
          </div>

          {removalTarget && (
            <SessionRemovalModal
              target={removalTarget}
              onClose={() => setRemovalTarget(null)}
              onDone={() => {
                setRemovalTarget(null)
                loadSessions()
              }}
            />
          )}
        </div>

        {/* Danger zone */}
        <div id="danger" className="scroll-mt-6 rounded-2xl border border-red-200 bg-red-50/50 p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600">
              <TriangleAlert size={20} />
            </span>
            <div>
              <h2 className="font-semibold text-slate-900 text-lg">Danger zone</h2>
              <p className="text-sm text-slate-500">Irreversible and account-level actions.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <LogOut size={17} />
              Sign out
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              Delete account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

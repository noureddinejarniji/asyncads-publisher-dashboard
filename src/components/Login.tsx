import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Mail, Eye, EyeOff, LoaderCircle, Lock, ShieldCheck } from 'lucide-react'

import { requestPasswordReset, resendTwoFactorLoginCode } from '../lib/auth'
import { useAuth } from '../lib/AuthContext'

type Mode = 'signin' | 'forgot' | 'twoFactor'

/** Dashboard sign-in screen, with an inline password-reset flow. */
export default function Login() {
  const navigate = useNavigate()
  const { signIn, verifyTwoFactorSignIn } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorToken, setTwoFactorToken] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorMethod, setTwoFactorMethod] = useState<'app' | 'email'>('app')
  const [twoFactorMaskedEmail, setTwoFactorMaskedEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendNote, setResendNote] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  /** Switches between sign-in and reset, clearing transient state. */
  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setResetSent(false)
    if (next !== 'twoFactor') {
      setTwoFactorToken('')
      setTwoFactorCode('')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (mode === 'forgot') {
      if (!email) {
        setError('Please enter your email.')
        return
      }
      setSubmitting(true)
      try {
        await requestPasswordReset(email)
        setResetSent(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (mode === 'twoFactor') {
      const code = twoFactorCode.replace(/\D/g, '')
      if (!twoFactorToken) {
        setError('Please sign in again.')
        switchMode('signin')
        return
      }
      if (code.length !== 6) {
        setError('Enter the 6-digit code from your authenticator app.')
        return
      }

      setSubmitting(true)
      try {
        await verifyTwoFactorSignIn(twoFactorToken, code)
        navigate('/')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    setSubmitting(true)
    try {
      const result = await signIn(email, password)
      if (result.twoFactorRequired) {
        setTwoFactorToken(result.challengeToken)
        setTwoFactorMethod(result.method ?? 'app')
        setTwoFactorMaskedEmail(result.maskedEmail ?? '')
        setTwoFactorCode('')
        setResendNote('')
        setPassword('')
        setMode('twoFactor')
        return
      }
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (!twoFactorToken || resending) return
    setResending(true)
    setError('')
    setResendNote('')
    try {
      await resendTwoFactorLoginCode(twoFactorToken)
      setResendNote('A new code is on its way.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend the code.')
    } finally {
      setResending(false)
    }
  }

  const isForgot = mode === 'forgot'
  const isTwoFactor = mode === 'twoFactor'
  const isEmail2fa = isTwoFactor && twoFactorMethod === 'email'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-violet via-brand-fuchsia to-brand-amber opacity-10 blur-[120px]" />

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo-light.png" alt="AsyncAds" className="mx-auto h-10 w-auto max-w-[180px] object-contain" />
          <h1 className="mt-6 text-2xl font-semibold text-slate-900">
            {isForgot ? 'Reset your password' : isTwoFactor ? 'Two-factor authentication' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isForgot
              ? "Enter your email and we'll send you a reset link."
              : isEmail2fa
                ? `Enter the 6-digit code we sent to ${twoFactorMaskedEmail || 'your email'}.`
                : isTwoFactor
                  ? 'Enter the 6-digit code from your authenticator app.'
                  : 'Sign in to your dashboard'}
          </p>
        </div>

        {isForgot && resetSent ? (
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 size={28} />
            </span>
            <p className="mt-4 font-medium text-slate-900">Check your inbox</p>
            <p className="mt-1 text-sm text-slate-500">
              If an account exists for <span className="font-medium text-slate-700">{email}</span>, a reset
              link is on its way.
            </p>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand-fuchsia transition-colors hover:text-brand-violet"
            >
              <ArrowLeft size={16} /> Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {isTwoFactor ? (
              <>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="two-factor-code">
                  {isEmail2fa ? 'Email code' : 'Authentication code'}
                </label>
                <div className="relative mb-2">
                  {isEmail2fa ? (
                    <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  ) : (
                    <ShieldCheck size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  )}
                  <input
                    id="two-factor-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-center font-mono text-lg tracking-[0.35em] text-slate-900 placeholder:text-slate-300 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
                  />
                </div>
                {isEmail2fa && (
                  <div className="mb-5 flex items-center justify-between text-xs">
                    <span className="text-emerald-600">{resendNote}</span>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="font-medium text-brand-fuchsia transition-colors hover:text-brand-violet disabled:opacity-60"
                    >
                      {resending ? 'Sending…' : 'Resend code'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <div className="relative mb-5">
              <Mail size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
              />
            </div>

            {!isForgot && (
              <>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-sm font-medium text-brand-fuchsia transition-colors hover:text-brand-violet"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative mb-5">
                  <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </>
            )}
              </>
            )}

            {error && (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-fuchsia px-5 py-3 text-base font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  {isForgot ? 'Sending...' : isTwoFactor ? 'Verifying...' : 'Signing in...'}
                </>
              ) : isForgot ? (
                'Send reset link'
              ) : isTwoFactor ? (
                'Verify code'
              ) : (
                'Sign in'
              )}
            </button>

            {(isForgot || isTwoFactor) && (
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
              >
                <ArrowLeft size={16} /> Back to sign in
              </button>
            )}

            {mode === 'signin' && (
              <p className="mt-6 text-center text-sm text-slate-500">
                Don't have an account?{' '}
                <Link to="/register" className="font-medium text-brand-fuchsia transition-colors hover:text-brand-violet">
                  Create one
                </Link>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

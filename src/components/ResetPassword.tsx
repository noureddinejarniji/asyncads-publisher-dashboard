import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LoaderCircle, Lock } from 'lucide-react'

import { resetPassword } from '../lib/auth'

/** Consumes the token from the emailed reset link and sets a new password. */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('This reset link is invalid or has expired. Please request a new one.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-violet via-brand-fuchsia to-brand-amber opacity-10 blur-[120px]" />

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo-light.png" alt="AsyncAds" className="mx-auto h-10 w-auto max-w-[180px] object-contain" />
          <h1 className="mt-6 text-2xl font-semibold text-slate-900">
            {done ? 'Password updated' : 'Choose a new password'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {done ? 'Your password has been reset.' : 'Enter a new password for your account.'}
          </p>
        </div>

        {done ? (
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 size={28} />
            </span>
            <p className="mt-4 text-sm text-slate-500">
              You can now sign in with your new password.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-fuchsia px-5 py-3 text-base font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90"
            >
              Back to sign in
            </Link>
          </div>
        ) : !token ? (
          <div className="text-center">
            <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              This reset link is invalid or has expired. Please request a new one.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-fuchsia transition-colors hover:text-brand-violet"
            >
              <ArrowLeft size={16} /> Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="password">
              New password
            </label>
            <div className="relative mb-5">
              <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
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

            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="confirm">
              Confirm password
            </label>
            <div className="relative mb-5">
              <Lock size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
              />
            </div>

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
                  Updating...
                </>
              ) : (
                'Reset password'
              )}
            </button>

            <Link
              to="/login"
              className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <ArrowLeft size={16} /> Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}

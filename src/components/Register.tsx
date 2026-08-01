import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Eye, EyeOff, Globe, LoaderCircle, Lock, Mail, MessageCircle, User } from 'lucide-react'

import { useAuth } from '../lib/AuthContext'
import type { ContactType } from '../lib/auth'

const CONTACT_TYPES: { value: ContactType; label: string; placeholder: string }[] = [
  { value: 'telegram', label: 'Telegram', placeholder: '@username' },
  { value: 'whatsapp', label: 'WhatsApp', placeholder: '+1 555 123 4567' },
  { value: 'teams', label: 'Microsoft Teams', placeholder: 'you@company.com' },
]

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20'

/** Dashboard publisher sign-up. Creates a pending account and signs in. */
export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [searchParams] = useSearchParams()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  // Prefill the email when arriving from the marketing site's "Get started" form.
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [contactType, setContactType] = useState<ContactType>('telegram')
  const [contactValue, setContactValue] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const contactMeta = CONTACT_TYPES.find((c) => c.value === contactType) ?? CONTACT_TYPES[0]

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your first and last name.')
      return
    }
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!companyName.trim()) {
      setError('Please enter your company name.')
      return
    }
    if (!websiteUrl.trim()) {
      setError('Please enter your website URL.')
      return
    }
    if (!contactValue.trim()) {
      setError(`Please enter your ${contactMeta.label} contact.`)
      return
    }

    setSubmitting(true)
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        companyName: companyName.trim(),
        websiteUrl: websiteUrl.trim(),
        contactType,
        contactValue: contactValue.trim(),
      })
      navigate('/')
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
          <h1 className="mt-6 text-2xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500">Start monetizing with AsyncAds</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="firstName">
                First name
              </label>
              <div className="relative">
                <User size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="lastName">
                Last name
              </label>
              <div className="relative">
                <User size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

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
              className={inputClass}
            />
          </div>

          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="password">
            Password
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
              className={`${inputClass} pr-11`}
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

          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="company">
            Company
          </label>
          <div className="relative mb-5">
            <Building2 size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="company"
              type="text"
              autoComplete="organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
              className={inputClass}
            />
          </div>

          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="website">
            Website
          </label>
          <div className="relative mb-5">
            <Globe size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="website"
              type="url"
              autoComplete="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className={inputClass}
            />
          </div>

          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="contactValue">
            Contact
          </label>
          <div className="mb-5 grid grid-cols-[140px_1fr] gap-3">
            <select
              aria-label="Contact method"
              value={contactType}
              onChange={(e) => setContactType(e.target.value as ContactType)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900 transition-colors focus:border-brand-fuchsia focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-fuchsia/20"
            >
              {CONTACT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="relative">
              <MessageCircle size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="contactValue"
                type="text"
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={contactMeta.placeholder}
                className={inputClass}
              />
            </div>
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
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-fuchsia transition-colors hover:text-brand-violet">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

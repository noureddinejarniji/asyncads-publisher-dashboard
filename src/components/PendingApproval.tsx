import { useState } from 'react'
import { Clock, LogOut, XCircle } from 'lucide-react'

import { useAuth } from '../lib/AuthContext'

/**
 * Shown to authenticated publishers whose account is not yet `active`.
 * A pending account is signed in but has no dashboard access until an admin
 * approves it; a rejected account is informed and can contact support.
 */
export default function PendingApproval() {
  const { publisher, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const rejected = publisher?.status === 'rejected'

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-violet via-brand-fuchsia to-brand-amber opacity-10 blur-[120px]" />

      <div className="w-full max-w-md text-center">
        <img src="/logo-light.png" alt="AsyncAds" className="mx-auto h-10 w-auto max-w-[180px] object-contain" />

        <span
          className={`mx-auto mt-8 grid h-16 w-16 place-items-center rounded-full ${
            rejected ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'
          }`}
        >
          {rejected ? <XCircle size={34} /> : <Clock size={34} />}
        </span>

        <h1 className="mt-6 text-2xl font-semibold text-slate-900">
          {rejected ? 'Account not approved' : 'Your account is pending'}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          {rejected ? (
            <>
              Unfortunately your application wasn’t approved. If you think this is a mistake, reach out to{' '}
              <a href="mailto:support@asyncads.com" className="font-medium text-brand-fuchsia hover:text-brand-violet">
                support@asyncads.com
              </a>
              .
            </>
          ) : (
            <>
              Thanks for signing up{publisher?.firstName ? `, ${publisher.firstName}` : ''}! Your account is under
              review by our team. We’ll email{' '}
              <span className="font-medium text-slate-700">{publisher?.email}</span> as soon as it’s approved — usually
              within one business day.
            </>
          )}
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <LogOut size={16} /> {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  )
}

import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, House, LifeBuoy } from 'lucide-react'

/**
 * Catch-all 404 shown for any unknown route under the dashboard shell. Keeps the
 * sidebar/header chrome (it's rendered inside the protected layout) so the user
 * stays oriented and can jump back into the app.
 */
export default function NotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-fuchsia/10 text-brand-fuchsia">
        <Compass size={32} />
      </span>

      <p className="mt-6 font-display text-7xl font-bold tracking-tight text-slate-900">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">
        We couldn’t find{' '}
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{pathname}</span>. It may have
        been moved, or the link is incorrect.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Go back
        </button>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-fuchsia px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-fuchsia/30 transition-colors hover:bg-brand-fuchsia/90"
        >
          <House size={16} />
          Back to overview
        </Link>
      </div>

      <Link
        to="/help"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-brand-fuchsia"
      >
        <LifeBuoy size={15} />
        Need help?
      </Link>
    </div>
  )
}

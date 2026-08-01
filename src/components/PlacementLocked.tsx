import { Link } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'

import pendingPlacementArt from '../assets/empty/pending-placement.png'

/**
 * Shown when a publisher opens a configuration page (steps, offers, promotions,
 * S2S) for a placement that hasn't been accepted yet. The API returns 403 with
 * `code: placement_not_accepted` for these placements; configuration unlocks
 * once the placement is approved and live.
 */
export default function PlacementLocked({
  slug,
  maxWidth = 'max-w-3xl',
}: {
  slug?: string
  maxWidth?: string
}) {
  return (
    <div className={`mx-auto ${maxWidth}`}>
      <Link to="/placements" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={16} /> Back to placements
      </Link>
      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
        <img
          src={pendingPlacementArt}
          alt=""
          aria-hidden="true"
          className="mx-auto mb-3 h-auto w-full max-w-[280px] object-contain"
        />
        <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-600">
          <Lock size={20} />
        </span>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">Configuration locked</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          This placement must be accepted before you can configure it. Once it's approved and live,
          configuration will unlock.
        </p>
        {slug && (
          <Link
            to={`/placements/${slug}`}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-fuchsia transition-colors hover:text-brand-violet"
          >
            View placement
          </Link>
        )}
      </div>
    </div>
  )
}

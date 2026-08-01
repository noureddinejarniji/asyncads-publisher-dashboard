import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, matchPath, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import InlineSpinner from './components/InlineSpinner'
import OfflinePopup from './components/OfflinePopup'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ToastProvider } from './components/toast'

// Per-route browser-tab titles. Patterns are matched whole (most-specific first),
// so a placement sub-page wins over the bare placement route.
const ROUTE_TITLES: [pattern: string, title: string][] = [
  ['/login', 'Sign in'],
  ['/register', 'Create account'],
  ['/reset-password', 'Reset password'],
  ['/', 'Overview'],
  ['/reports', 'Reports'],
  ['/placements/:slug/config/s2s', 'S2S postbacks'],
  ['/placements/:slug/config/promotions', 'Promotions'],
  ['/placements/:slug/config/offers', 'Offers'],
  ['/placements/:slug/config', 'Configuration'],
  ['/placements/:slug', 'Placement'],
  ['/placements', 'Placements'],
  ['/payment', 'Payment'],
  ['/docs', 'Documentation'],
  ['/legal/terms', 'Terms of Service'],
  ['/legal/privacy', 'Privacy Policy'],
  ['/legal/dpa', 'Data Processing Agreement'],
  ['/legal/cookies', 'Cookie Policy'],
  ['/settings', 'Settings'],
  ['/help', 'Help'],
]

/** Keeps the document title in sync with the active route. */
function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const match = ROUTE_TITLES.find(([pattern]) => matchPath(pattern, pathname))
    document.title = `${match?.[1] ?? 'Publisher Dashboard'} · AsyncAds`
  }, [pathname])
  return null
}

/** Full-screen loader shown during Suspense and the initial auth bootstrap. */
function AppLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
      <InlineSpinner className="h-6 w-6 text-brand-fuchsia" />
    </div>
  )
}

const Login = lazy(() => import('./components/Login'))
const Register = lazy(() => import('./components/Register'))
const ResetPassword = lazy(() => import('./components/ResetPassword'))
const PendingApproval = lazy(() => import('./components/PendingApproval'))
const DashboardLayout = lazy(() => import('./components/DashboardLayout'))
const Overview = lazy(() => import('./pages/Overview'))
const Placements = lazy(() => import('./pages/Placements'))
const PlacementDetail = lazy(() => import('./pages/PlacementDetail'))
const PlacementConfig = lazy(() => import('./pages/PlacementConfig'))
const S2SConfig = lazy(() => import('./pages/S2SConfig'))
const Promotions = lazy(() => import('./pages/Promotions'))
const OffersControl = lazy(() => import('./pages/OffersControl'))
const Reports = lazy(() => import('./pages/Reports'))

const Payment = lazy(() => import('./pages/Payment'))
const Docs = lazy(() => import('./pages/Docs'))
const Terms = lazy(() => import('./pages/legal/terms'))
const Privacy = lazy(() => import('./pages/legal/privacy'))
const Dpa = lazy(() => import('./pages/legal/dpa'))
const CookiePolicy = lazy(() => import('./pages/legal/cookies'))
const Settings = lazy(() => import('./pages/Settings'))
const Help = lazy(() => import('./pages/Help'))
const NotFound = lazy(() => import('./pages/NotFound'))

/**
 * Gates protected routes on the live auth state: wait during bootstrap, redirect
 * to /login only once we know the user is unauthenticated.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, publisher } = useAuth()
  if (status === 'loading') return <AppLoader />
  if (status === 'unauthenticated') return <Navigate to="/login" replace />
  // Authenticated but not yet activated: pending/rejected accounts get the
  // approval screen instead of the dashboard until an admin activates them.
  if (publisher && publisher.status !== 'active') return <PendingApproval />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <OfflinePopup />
        <BrowserRouter>
          <RouteTitle />
          <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Overview />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/*" element={<Navigate to="/reports" replace />} />
            <Route path="/placements" element={<Placements />} />
            <Route path="/placements/:slug" element={<PlacementDetail />} />
            <Route path="/placements/:slug/config" element={<PlacementConfig />} />
            <Route path="/placements/:slug/config/s2s" element={<S2SConfig />} />
            <Route path="/placements/:slug/config/promotions" element={<Promotions />} />
            <Route path="/placements/:slug/config/offers" element={<OffersControl />} />
            <Route path="/offers" element={<Navigate to="/" replace />} />
            <Route path="/payment" element={<Payment />} />
            {/* Renamed from Payouts → Payment; keep old links/bookmarks working. */}
            <Route path="/payouts" element={<Navigate to="/payment" replace />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/legal/privacy" element={<Privacy />} />
            <Route path="/legal/dpa" element={<Dpa />} />
            <Route path="/legal/cookies" element={<CookiePolicy />} />
            <Route path="/legal/*" element={<Navigate to="/legal/terms" replace />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
            {/* Unknown authenticated routes render the 404 inside the dashboard shell. */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

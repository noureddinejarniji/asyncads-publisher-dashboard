import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BookOpen, Check, Cookie, FileText, HelpCircle, House, LayoutGrid, List, LogOut, MessageSquare, PieChart, Scale, Search, Settings, ShieldCheck, Wallet, X, type LucideIcon as Icon } from 'lucide-react'
import InlineSpinner from './InlineSpinner'

import { apiGet } from '../lib/auth'
import { useAuth } from '../lib/AuthContext'

type SearchPlacement = { slug: string; publicId: string; name: string; domain: string | null; status: string }

const STATUS_DOT: Record<string, string> = {
  live: 'bg-emerald-500',
  pending_review: 'bg-amber-400',
  draft: 'bg-slate-300',
}

/** Header search over the publisher's placements; navigates to a match. */
function HeaderSearch() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<SearchPlacement[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const loadedRef = useRef(false)

  // Lazy: only fetch the placements list the first time the user focuses the
  // search box, so pages where search is never used don't pay for it.
  const loadPlacements = () => {
    if (loadedRef.current) return
    loadedRef.current = true
    apiGet<{ placements: SearchPlacement[] }>('/api/placements')
      .then((d) => setItems(d.placements ?? []))
      .catch(() => {
        loadedRef.current = false
      })
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = query.trim().toLowerCase()
  const results = q
    ? items
        .filter((p) => p.name.toLowerCase().includes(q) || (p.domain ?? '').toLowerCase().includes(q))
        .slice(0, 6)
    : []

  function go(slug: string) {
    setQuery('')
    setOpen(false)
    navigate(`/placements/${slug}`)
  }

  return (
    <div ref={ref} className="group relative hidden max-w-2xl flex-1 sm:block">
      <Search
        size={20}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-brand-fuchsia"
      />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          loadPlacements()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) go(results[0].slug)
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Search placements..."
        className="w-full rounded-full border border-transparent bg-slate-100 py-2.5 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-500 transition-all focus:border-slate-200 focus:bg-white focus:shadow-md focus:outline-none"
      />
      {open && q && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">No placements match “{query.trim()}”.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => go(p.slug)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[p.status] ?? 'bg-slate-300'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
                  {p.domain && <span className="block truncate text-xs text-slate-400">{p.domain}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

type NavItem = { to: string; label: string; icon: Icon }

const leafClass = (isActive: boolean) =>
  `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-fuchsia/10 text-brand-fuchsia'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

const getDisplayName = (email: string) => {
  const name = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim()

  if (!name) return 'Publisher'

  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Available-balance chip shown in the header. */
/*
function HeaderBalance() {
  const [balance, setBalance] = useState<number | null>(null)
  useEffect(() => {
    apiGet<{ balance: number }>('/api/account/balance')
      .then((d) => setBalance(d.balance))
      .catch(() => undefined)
  }, [])
  return (
    <Link
      to="/payment"
      title="Available balance — view payment"
      className="group hidden items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition-all hover:-translate-y-px hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-600/10 sm:inline-flex"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 transition-colors group-hover:bg-emerald-100">
        <Wallet size={15} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Balance</span>
        {balance === null ? (
          <span className="mt-1 h-3 w-12 animate-pulse rounded bg-slate-200" />
        ) : (
          <span className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </span>
      <ChevronRight
        size={15}
        className="-ml-0.5 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500"
      />
    </Link>
  )
}
*/

export default function DashboardLayout() {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const { publisher, signOut } = useAuth()
  const email = publisher?.email ?? ''
  const displayName = publisher?.name?.trim() || getDisplayName(email)
  const accountName = publisher?.companyName?.trim() || displayName
  const accountRole = publisher?.status === 'active' ? 'admin' : publisher?.status || 'admin'
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'P'
  const accountInitials =
    accountName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || initials

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const navItems: NavItem[] = [
    { to: '/', label: 'Overview', icon: House },
    { to: '/placements', label: 'Placements', icon: LayoutGrid },
    { to: '/reports', label: 'Reports', icon: PieChart },
    { to: '/payment', label: 'Payment', icon: Wallet },
    { to: '/docs', label: 'Docs', icon: BookOpen },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]
  const legalItems: NavItem[] = [
    { to: '/legal/terms', label: 'Terms', icon: Scale },
    { to: '/legal/privacy', label: 'Privacy', icon: ShieldCheck },
    { to: '/legal/dpa', label: 'DPA', icon: FileText },
    { to: '/legal/cookies', label: 'Cookie Policy', icon: Cookie },
  ]

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:max-w-none lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-6">
          <img src="/logo-light.png" alt="AsyncAds" className="h-9 w-auto max-w-[150px] object-contain" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-1">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Menu
            </p>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) => leafClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} />
                    {item.label}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-fuchsia" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-1 border-t border-slate-100 pt-4">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Legal
            </p>
            {legalItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => leafClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} />
                    {item.label}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-fuchsia" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Account manager card */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            <div className="relative shrink-0">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-fuchsia text-xs font-semibold text-white">
                SK
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-50 bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">Sarah Klein</p>
              <p className="truncate text-[11px] text-slate-400">Account manager</p>
            </div>
            <a
              href="https://teams.microsoft.com/l/chat/0/0?users=sarah@asyncads.com"
              target="_blank"
              rel="noreferrer"
              title="Message on Teams"
              aria-label="Message on Teams"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-fuchsia text-white transition-colors hover:bg-brand-fuchsia/90"
            >
              <MessageSquare size={15} />
            </a>
          </div>
        </div>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut size={20} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {open && (
        <div className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-10 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:gap-4 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <List size={24} />
          </button>
          <img src="/logo-light.png" alt="AsyncAds" className="h-8 w-auto max-w-[132px] object-contain lg:hidden" />

          {/* Search over placements */}
          <HeaderSearch />

          <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
            <NavLink
              to="/help"
              aria-label="Help"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 max-sm:hidden"
            >
              <HelpCircle size={22} />
            </NavLink>
            <NavLink
              to="/settings"
              aria-label="Settings"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 max-sm:hidden"
            >
              <Settings size={22} />
            </NavLink>
            <div ref={profileRef} className="relative ml-1">
              <button
                type="button"
                title={displayName}
                aria-label={`Account: ${displayName}`}
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((value) => !value)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-fuchsia text-xs font-bold text-white shadow-sm shadow-brand-fuchsia/25 ring-2 ring-white transition-transform hover:scale-105 sm:h-10 sm:w-10 sm:text-sm"
              >
                {initials}
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-1rem))] overflow-hidden border border-slate-200 bg-white py-1.5 shadow-2xl shadow-slate-900/15">
                  {/* Identity */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-fuchsia text-sm font-bold text-white shadow-sm shadow-brand-fuchsia/25">
                      {initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold leading-5 text-slate-900">{displayName}</span>
                      <span className="block truncate text-xs leading-4 text-slate-400">{email}</span>
                    </span>
                  </div>

                  {/* Active publisher account */}
                  <div className="border-t border-slate-100 px-2 pt-2">
                    <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                      Publisher Account
                    </p>
                    <div className="flex items-center gap-3 bg-gradient-to-r from-brand-violet to-brand-fuchsia px-3 py-2.5 text-white">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-xs font-bold text-white ring-1 ring-inset ring-white/30">
                        {accountInitials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-5">{accountName}</span>
                        <span className="block truncate text-xs capitalize leading-4 text-white/75">{accountRole}</span>
                      </span>
                      <Check size={18} className="shrink-0" aria-label="Active account" />
                    </div>
                  </div>

                  {/* Logout */}
                  <div className="mt-1.5 border-t border-slate-100 px-2 pt-1.5">
                    <button
                      type="button"
                      onClick={signOut}
                      className="flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <LogOut size={18} className="shrink-0" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-8 sm:pb-8">
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <InlineSpinner />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

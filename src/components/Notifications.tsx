import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, Megaphone, TrendingUp, TriangleAlert, Wallet, X, type LucideIcon as Icon } from 'lucide-react'
import { createPortal } from 'react-dom'

type Tone = 'green' | 'fuchsia' | 'blue' | 'amber'

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-600',
  fuchsia: 'bg-brand-fuchsia/10 text-brand-fuchsia',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
}

type Notification = {
  id: string
  title: string
  body: string
  time: string
  icon: Icon
  tone: Tone
  to?: string
  read: boolean
}

const SEED: Notification[] = [
  {
    id: 'n1',
    title: 'Payout sent',
    body: '$1,840.20 is on its way to your wallet.',
    time: '2m ago',
    icon: Wallet,
    tone: 'green',
    to: '/payment',
    read: false,
  },
  {
    id: 'n2',
    title: 'Offer approved',
    body: 'Cash App is now live on your offerwall.',
    time: '1h ago',
    icon: CheckCircle2,
    tone: 'fuchsia',
    to: '/placements',
    read: false,
  },
  {
    id: 'n3',
    title: 'Conversions spiking',
    body: 'Conversions are up 24% in the last hour.',
    time: '3h ago',
    icon: TrendingUp,
    tone: 'blue',
    to: '/reports/conversions',
    read: false,
  },
  {
    id: 'n4',
    title: 'Postbacks failing',
    body: '3 callbacks to your endpoint failed to deliver.',
    time: 'Yesterday',
    icon: TriangleAlert,
    tone: 'amber',
    to: '/reports/postbacks',
    read: true,
  },
  {
    id: 'n5',
    title: 'Promotion ended',
    body: 'Your Weekend boost promotion has ended.',
    time: '2d ago',
    icon: Megaphone,
    tone: 'fuchsia',
    read: true,
  },
]

export default function Notifications() {
  const [open, setOpen] = useState(false)
  const [render, setRender] = useState(false) // kept mounted through the exit animation
  const [enter, setEnter] = useState(false) // drives the slide/fade transition
  const [items, setItems] = useState<Notification[]>(SEED)
  const navigate = useNavigate()

  const unread = items.filter((notification) => !notification.read).length

  // Mount/unmount bookkeeping adjusted during render; the effect only drives
  // the async parts of the transition (enter frame, exit delay).
  if (open && !render) setRender(true)
  if (!open && enter) setEnter(false)

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEnter(true)))
      return () => cancelAnimationFrame(raf)
    }
    const timer = setTimeout(() => setRender(false), 200)
    return () => clearTimeout(timer)
  }, [open])

  // Close on Escape (outside clicks are handled by the backdrop).
  useEffect(() => {
    if (!render) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [render])

  const markAllRead = () => setItems((list) => list.map((notification) => ({ ...notification, read: true })))

  function openItem(notification: Notification) {
    setItems((list) => list.map((item) => (item.id === notification.id ? { ...item, read: true } : item)))
    setOpen(false)
    if (notification.to) navigate(notification.to)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell size={22} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-fuchsia px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {render &&
        createPortal(
          <>
          <div
            className={`fixed inset-0 z-40 bg-slate-950/20 transition-opacity duration-200 ${
              enter ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setOpen(false)}
          />
          <div
            className={`fixed inset-y-0 right-0 z-50 flex w-96 max-w-[calc(100vw-1.5rem)] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ease-out will-change-transform motion-reduce:transition-none sm:w-[28rem] ${
              enter ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">Notifications</h3>
                {unread > 0 && (
                  <span className="rounded-full bg-brand-fuchsia/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand-fuchsia">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unread === 0}
                  className="text-xs font-medium text-brand-fuchsia transition-colors hover:text-brand-violet disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  Mark read
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">You're all caught up.</p>
              ) : (
                items.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openItem(notification)}
                    className={`flex w-full items-start gap-3 border-b border-slate-50 px-5 py-4 text-left transition-colors last:border-0 hover:bg-slate-50 ${
                      notification.read ? '' : 'bg-brand-fuchsia/[0.03]'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                        TONES[notification.tone]
                      }`}
                    >
                      <notification.icon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{notification.title}</p>
                        {!notification.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-fuchsia" />}
                      </div>
                      <p className="mt-0.5 text-sm leading-5 text-slate-500">{notification.body}</p>
                      <p className="mt-1 text-xs text-slate-400">{notification.time}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>,
          document.body,
        )}
    </div>
  )
}

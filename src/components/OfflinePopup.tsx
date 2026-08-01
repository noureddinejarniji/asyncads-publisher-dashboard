import { useEffect, useRef, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

/**
 * Global connectivity popup: shows a banner while the browser is offline, and a
 * brief "back online" confirmation when the connection returns. Mounted once at
 * the app root so it overlays every page.
 */
export default function OfflinePopup() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [showReconnected, setShowReconnected] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function goOffline() {
      setOnline(false)
      setShowReconnected(false)
    }
    function goOnline() {
      setOnline(true)
      setShowReconnected(true)
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  // While offline, fully lock the app: the overlay blocks mouse clicks, and these
  // capture-phase listeners swallow keyboard navigation, shortcuts and scrolling so
  // no action can reach the page behind the modal. Anything inside the modal itself
  // is allowed through.
  useEffect(() => {
    if (online) return

    const block = (e: Event) => {
      const target = e.target as Node | null
      if (modalRef.current && target && modalRef.current.contains(target)) return
      e.stopPropagation()
      if (e.cancelable) e.preventDefault()
    }

    const events: Array<keyof DocumentEventMap> = [
      'keydown',
      'keyup',
      'keypress',
      'wheel',
      'touchmove',
      'contextmenu',
    ]
    events.forEach((ev) =>
      document.addEventListener(ev, block, { capture: true, passive: false }),
    )

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Pull focus into the modal so Tab can't reach controls behind it.
    modalRef.current?.focus()

    return () => {
      events.forEach((ev) => document.removeEventListener(ev, block, { capture: true }))
      document.body.style.overflow = prevOverflow
    }
  }, [online])

  // Auto-dismiss the "back online" confirmation after a few seconds.
  useEffect(() => {
    if (!showReconnected) return
    const t = setTimeout(() => setShowReconnected(false), 3500)
    return () => clearTimeout(t)
  }, [showReconnected])

  // While offline: a blocking modal that prevents any interaction with the app
  // until the connection returns.
  if (!online) {
    return (
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="offline-title"
        tabIndex={-1}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 px-4 outline-none backdrop-blur-sm"
      >
        <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-xl">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-amber-600">
            <WifiOff size={24} />
          </span>
          <h2 id="offline-title" className="mt-4 text-base font-semibold text-slate-900">
            You’re offline
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your connection was lost. We’ll restore access automatically as soon as you’re back online.
          </p>
        </div>
      </div>
    )
  }

  // Back online: a small, non-blocking confirmation pill.
  if (!showReconnected) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex justify-end">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-md"
      >
        <Wifi size={14} className="shrink-0" />
        <span>Back online</span>
      </div>
    </div>
  )
}

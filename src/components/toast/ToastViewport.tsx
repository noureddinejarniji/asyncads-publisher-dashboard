import { useEffect, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'

import { ToastItem } from './ToastItem'
import { dismissToast, getSnapshot, subscribe } from './store'

/**
 * The single global toast viewport. Portals to document.body so it floats above
 * every modal/overlay. Desktop: bottom-right. Mobile: bottom-center. Newest
 * toast sits at the corner and pushes older ones up. Honors safe-area insets.
 */
export function ToastViewport() {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Escape dismisses the newest (corner) toast.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && toasts.length > 0) {
        dismissToast(toasts[0].id)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toasts])

  if (typeof document === 'undefined') return null

  // Snapshot is newest-first; render oldest-first so the newest lands nearest
  // the bottom-right corner (older toasts stack upward).
  const ordered = [...toasts].reverse()

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex flex-col items-center gap-2.5 sm:inset-x-auto sm:right-0 sm:items-end"
      style={{
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
      }}
    >
      <AnimatePresence initial={false}>
        {ordered.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

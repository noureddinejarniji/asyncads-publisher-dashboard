import type { ReactNode } from 'react'

import { ToastViewport } from './ToastViewport'

/**
 * Mounts the global toast viewport once. The toast state itself lives in a
 * module-level store, so this provider holds no state and only needs to render
 * the viewport — there must be exactly one of these near the app root.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToastViewport />
    </>
  )
}

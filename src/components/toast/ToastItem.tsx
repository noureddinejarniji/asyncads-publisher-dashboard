import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'

import { dismissToast } from './store'
import type { Toast, ToastVariant } from './types'

const ICONS = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
  loading: LoaderCircle,
} as const

// Status color is carried by a soft icon chip — the card surface stays neutral.
const CHIP: Record<ToastVariant, string> = {
  success: 'bg-emerald-50 text-emerald-600',
  error: 'bg-red-50 text-red-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-sky-50 text-sky-600',
  loading: 'bg-slate-100 text-slate-500',
}

export function ToastItem({ toast }: { toast: Toast }) {
  const reduceMotion = useReducedMotion()
  const Icon = ICONS[toast.variant]
  const [paused, setPaused] = useState(false)

  // Remaining time survives pause/resume and resets when the toast is updated.
  const remainingRef = useRef(toast.duration)
  useEffect(() => {
    remainingRef.current = toast.duration
  }, [toast.duration, toast.updatedAt])

  useEffect(() => {
    if (!Number.isFinite(toast.duration) || paused) return
    const startedAt = Date.now()
    const timer = window.setTimeout(() => dismissToast(toast.id), remainingRef.current)
    return () => {
      window.clearTimeout(timer)
      remainingRef.current -= Date.now() - startedAt
    }
  }, [paused, toast.duration, toast.updatedAt, toast.id])

  const isError = toast.variant === 'error'

  return (
    <motion.div
      layout
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="pointer-events-auto flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-lg shadow-slate-900/10 ring-1 ring-black/[0.02]"
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${CHIP[toast.variant]}`}>
        <Icon size={17} aria-hidden="true" className={toast.variant === 'loading' ? 'animate-spin' : ''} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {toast.title && <p className="text-sm font-semibold text-slate-900">{toast.title}</p>}
        {toast.message && (
          <p className={`text-sm leading-5 text-slate-600 ${toast.title ? 'mt-0.5' : ''}`}>{toast.message}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
        className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <X size={15} />
      </button>
    </motion.div>
  )
}

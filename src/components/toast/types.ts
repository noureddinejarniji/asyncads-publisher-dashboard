export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading'

/** A toast's content: either a plain message, or a title + message pair. */
export type ToastContent = string | { title?: string; message?: string }

/** Options accepted by the public toast API and toast.update(). */
export type ToastOptions = {
  /** Provide a stable id to update/dedupe a specific toast. */
  id?: string
  /** Auto-dismiss after N ms; use Infinity for persistent (loading). */
  duration?: number
  /** Override the duplicate-prevention key (defaults to variant+title+message). */
  dedupeKey?: string
  title?: string
  message?: string
  variant?: ToastVariant
}

/** A fully-resolved toast held in the store. */
export type Toast = {
  id: string
  variant: ToastVariant
  title?: string
  message?: string
  duration: number
  dedupeKey: string
  createdAt: number
  updatedAt: number
}

/** Input to the store when creating a toast. */
export type ToastInput = {
  variant: ToastVariant
  title?: string
  message?: string
  duration?: number
  id?: string
  dedupeKey?: string
}

export type PromiseMessages<T> = {
  loading: ToastContent
  success: ToastContent | ((value: T) => ToastContent)
  error: ToastContent | ((error: unknown) => ToastContent)
}

/** Default auto-dismiss durations (ms). Loading is persistent. */
export const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 4000,
  info: 4500,
  warning: 6000,
  error: 7000,
  loading: Number.POSITIVE_INFINITY,
}

export const MAX_VISIBLE_TOASTS = 4

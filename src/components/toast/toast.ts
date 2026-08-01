// The global, hook-free toast API. Import and call from anywhere — components,
// axios interceptors, auth helpers, stores, utilities.

import { addToast, dismissAll, dismissToast, updateToast } from './store'
import {
  DEFAULT_DURATIONS,
  type PromiseMessages,
  type ToastContent,
  type ToastOptions,
  type ToastVariant,
} from './types'

function resolveContent(content: ToastContent): { title?: string; message?: string } {
  if (typeof content === 'string') return { message: content }
  return { title: content.title, message: content.message }
}

function show(variant: ToastVariant, content: ToastContent, options: ToastOptions = {}): string {
  const base = resolveContent(content)
  return addToast({
    variant,
    title: options.title ?? base.title,
    message: options.message ?? base.message,
    duration: options.duration,
    id: options.id,
    dedupeKey: options.dedupeKey,
  })
}

function resolve<T>(value: ToastContent | ((arg: T) => ToastContent), arg: T): ToastContent {
  return typeof value === 'function' ? (value as (arg: T) => ToastContent)(arg) : value
}

export const toast = {
  success: (content: ToastContent, options?: ToastOptions) => show('success', content, options),
  error: (content: ToastContent, options?: ToastOptions) => show('error', content, options),
  warning: (content: ToastContent, options?: ToastOptions) => show('warning', content, options),
  info: (content: ToastContent, options?: ToastOptions) => show('info', content, options),
  loading: (content: ToastContent, options?: ToastOptions) =>
    show('loading', content, { duration: Number.POSITIVE_INFINITY, ...options }),

  /** Patch an existing toast (e.g. loading → success/error) by id. */
  update: (id: string, options: ToastOptions) => {
    updateToast(id, {
      variant: options.variant,
      title: options.title,
      message: options.message,
      duration: options.duration,
    })
  },

  dismiss: (id: string) => dismissToast(id),
  dismissAll: () => dismissAll(),

  /**
   * Drives one toast through a promise's lifecycle: a single notification that
   * updates from loading to success or error (never stacks).
   */
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>, options?: ToastOptions): Promise<T> => {
    const id = show('loading', messages.loading, { duration: Number.POSITIVE_INFINITY, ...options })
    promise.then(
      (value) => {
        const content = resolveContent(resolve(messages.success, value))
        updateToast(id, { variant: 'success', ...content, duration: DEFAULT_DURATIONS.success })
      },
      (error: unknown) => {
        const content = resolveContent(resolve(messages.error, error))
        updateToast(id, { variant: 'error', ...content, duration: DEFAULT_DURATIONS.error })
      },
    )
    return promise
  },
}

export type ToastApi = typeof toast

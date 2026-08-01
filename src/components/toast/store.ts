// Framework-agnostic toast store. Module-level state + a tiny pub/sub so the
// public `toast` API works anywhere (axios interceptors, auth helpers, plain
// utilities) and the React viewport subscribes via useSyncExternalStore.

import { DEFAULT_DURATIONS, MAX_VISIBLE_TOASTS, type Toast, type ToastInput } from './types'

let all: Toast[] = [] // every live toast, newest first
let visible: Toast[] = [] // cached snapshot = first MAX_VISIBLE (stable reference)
const listeners = new Set<() => void>()

function recompute() {
  visible = all.slice(0, MAX_VISIBLE_TOASTS)
}

function emit() {
  recompute()
  for (const listener of listeners) listener()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Stable snapshot of the visible toasts (extra toasts are queued, not rendered). */
export function getSnapshot(): Toast[] {
  return visible
}

function genId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function defaultDedupeKey(input: ToastInput): string {
  return input.dedupeKey ?? `${input.variant}:${input.title ?? ''}:${input.message ?? ''}`
}

/**
 * Adds a toast (or refreshes an existing one with the same dedupe key). Returns
 * the toast id so callers can later update/dismiss it.
 */
export function addToast(input: ToastInput): string {
  const dedupeKey = defaultDedupeKey(input)

  // Update-by-id takes precedence when an explicit id is supplied.
  if (input.id) {
    const existing = all.find((t) => t.id === input.id)
    if (existing) {
      updateToast(input.id, input)
      return input.id
    }
  }

  // Duplicate prevention: refresh the existing toast instead of stacking a copy.
  const dupe = all.find((t) => t.dedupeKey === dedupeKey)
  if (dupe) {
    updateToast(dupe.id, input)
    return dupe.id
  }

  const now = Date.now()
  const toast: Toast = {
    id: input.id ?? genId(),
    variant: input.variant,
    title: input.title,
    message: input.message,
    duration: input.duration ?? DEFAULT_DURATIONS[input.variant],
    dedupeKey,
    createdAt: now,
    updatedAt: now,
  }
  all = [toast, ...all]
  emit()
  return toast.id
}

/** Patches a toast in place (same id → same React key → animates, restarts timer). */
export function updateToast(id: string, patch: Partial<ToastInput>): void {
  let found = false
  all = all.map((t) => {
    if (t.id !== id) return t
    found = true
    const variant = patch.variant ?? t.variant
    // When the variant changes without an explicit duration, adopt the new
    // variant's default (loading → success/error gets a finite lifetime).
    const duration =
      patch.duration ?? (patch.variant && patch.variant !== t.variant ? DEFAULT_DURATIONS[variant] : t.duration)
    return {
      ...t,
      variant,
      title: patch.title ?? t.title,
      message: patch.message ?? t.message,
      duration,
      updatedAt: Date.now(),
    }
  })
  if (found) emit()
}

export function dismissToast(id: string): void {
  const next = all.filter((t) => t.id !== id)
  if (next.length !== all.length) {
    all = next
    emit()
  }
}

export function dismissAll(): void {
  if (all.length === 0) return
  all = []
  emit()
}

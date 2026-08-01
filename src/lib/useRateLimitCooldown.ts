import { useCallback, useEffect, useRef, useState } from 'react'

import { getRetryAfterSeconds, isRateLimitError } from './auth'

/**
 * Action-scoped rate-limit cooldown. Wire this into a single button/mutation so
 * a 429's Retry-After can temporarily disable just that action with a countdown
 * — never the whole page, and never a shared global cooldown.
 *
 * Usage:
 *   const cooldown = useRateLimitCooldown()
 *   try { await save() }
 *   catch (err) { if (!cooldown.startFromError(err)) toast.error(...) }
 *   <button disabled={cooldown.active}>{cooldown.active ? `Retry in ${cooldown.secondsLeft}s` : 'Save'}</button>
 */
export function useRateLimitCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(
    (seconds: number) => {
      clear()
      if (seconds <= 0) return
      setSecondsLeft(seconds)
      timerRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clear()
            return 0
          }
          return s - 1
        })
      }, 1000)
    },
    [clear],
  )

  /**
   * If `error` is a 429, begins the cooldown (when Retry-After is present) and
   * returns true so the caller can skip its generic error toast. Returns false
   * for non-rate-limit errors, which the caller should handle normally.
   */
  const startFromError = useCallback(
    (error: unknown): boolean => {
      if (!isRateLimitError(error)) return false
      start(getRetryAfterSeconds(error) ?? 0)
      return true
    },
    [start],
  )

  useEffect(() => clear, [clear])

  return { secondsLeft, active: secondsLeft > 0, start, startFromError }
}

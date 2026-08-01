import axios from 'axios'

const FALLBACK = 'Something went wrong. Please try again.'

/** Shown for any network/connection/timeout failure instead of a raw transport message. */
export const CONNECTION_ERROR_MESSAGE = 'Connection error. Please check your internet and try again.'

/**
 * True when a request never produced a usable HTTP response — i.e. it failed at
 * the transport layer (offline, DNS, CORS, timeout, server unreachable). These
 * surface as "Network Error" (axios) or "Failed to fetch" (native fetch), which
 * we never want to show the user verbatim.
 */
export function isConnectionError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (!error.response) return true
    if (error.code && ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code)) return true
  }
  // Native fetch transport failures throw a TypeError with these messages.
  if (error instanceof TypeError && /failed to fetch|networkerror|network error|load failed/i.test(error.message)) {
    return true
  }
  return false
}

/**
 * Turns any thrown value into a human-readable string for a toast.
 * Connection failures → a friendly connection message. Otherwise:
 * axios `{ error }` → axios `{ message }` → Error.message → string → safe
 * fallback. Never returns "[object Object]", "undefined", a stack trace, or a
 * raw transport message like "Network Error" / "Failed to fetch".
 */
export function getReadableErrorMessage(error: unknown): string {
  if (isConnectionError(error)) return CONNECTION_ERROR_MESSAGE

  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      if (typeof record.error === 'string' && record.error.trim()) return record.error
      if (typeof record.message === 'string' && record.message.trim()) return record.message
    }
    if (typeof data === 'string' && data.trim() && !data.trim().startsWith('<')) return data
    if (error.message.trim() && !isTransportMessage(error.message)) return error.message
  }

  if (error instanceof Error && error.message.trim() && !isTransportMessage(error.message)) return error.message
  if (typeof error === 'string' && error.trim() && !isTransportMessage(error)) return error

  return FALLBACK
}

/** Raw transport-layer messages we never surface verbatim. */
function isTransportMessage(message: string): boolean {
  return /failed to fetch|network error|load failed/i.test(message)
}

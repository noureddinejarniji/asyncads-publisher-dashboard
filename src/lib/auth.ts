// Publisher authentication against the AsyncAds API — all requests go through axios.
//
// Security model:
//  - The access token (JWT) lives ONLY in module memory (never localStorage,
//    sessionStorage, cookies, or IndexedDB). It vanishes on reload and is
//    restored by bootstrapAuth() via the refresh cookie.
//  - The refresh token is an httpOnly/Secure/SameSite cookie the server sets and
//    rotates; JavaScript never reads or stores it. `withCredentials: true` sends
//    it automatically.

import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

import { toast } from '@/components/toast/toast'
import { CONNECTION_ERROR_MESSAGE, isConnectionError } from '@/components/toast/getReadableErrorMessage'

// Per-request bookkeeping for the refresh-on-401 logic.
declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    /** Set once a request has already been retried — caps retries at one. */
    _authRetry?: boolean
    /** The access token this request was actually sent with. */
    _accessTokenUsed?: string | null
  }
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3001'
const AUTH_PATH = '/api/auth/publisher'

// Auth endpoints that must never trigger the generic refresh-on-401 retry
// (otherwise a failed login/refresh/logout would loop into another refresh).
const NO_REFRESH_PATHS = ['/register', '/login', '/login/2fa', '/login/2fa/resend', '/refresh', '/logout', '/forgot-password', '/reset-password']

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false
  return NO_REFRESH_PATHS.some((p) => url === `${AUTH_PATH}${p}`)
}

export type ContactType = 'telegram' | 'whatsapp' | 'teams'

export type Publisher = {
  id: number
  email: string
  name: string
  firstName: string | null
  lastName: string | null
  companyName: string | null
  websiteUrl: string | null
  contactType: ContactType | null
  contactValue: string | null
  status: string
  emailVerifiedAt: string | null
  twoFactorEnabled: boolean
  twoFactorMethod?: 'app' | 'email'
  lastLoginAt: string | null
  createdAt: string
}

export type Auth = { accessToken: string; publisher: Publisher }
export type TwoFactorMethod = 'app' | 'email'
export type TwoFactorChallenge = {
  twoFactorRequired: true
  challengeToken: string
  method?: TwoFactorMethod
  maskedEmail?: string
}
export type LoginResult = Publisher | TwoFactorChallenge

export function isTwoFactorChallenge(result: LoginResult): result is TwoFactorChallenge {
  return 'twoFactorRequired' in result && result.twoFactorRequired === true
}

// ---------------------------------------------------------------------------
// In-memory access-token store. This is the ONLY place the access token lives.
// ---------------------------------------------------------------------------
let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

// Handler the React auth layer registers so it can flip to "unauthenticated"
// when a refresh ultimately fails. Avoids a hard page reload.
let onAuthExpired: (() => void) | null = null

export function setAuthExpiredHandler(handler: (() => void) | null): void {
  onAuthExpired = handler
}

/** Clears the in-memory token and notifies the React layer (idempotent). */
function expireSession(): void {
  setAccessToken(null)
  toast.error(
    { title: 'Session expired', message: 'Please sign in again to continue.' },
    { dedupeKey: 'session-expired' },
  )
  onAuthExpired?.()
}

// Shared axios instance: same origin as the API, sends the refresh cookie, and
// attaches the in-memory Bearer access token on every request when present.
// Exported for tests (which swap in a mock adapter); app code uses the helpers.
export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
})

http.interceptors.request.use((config) => {
  const token = getAccessToken()
  // Record which token this request rode out with, so a late 401 can tell
  // whether a refresh has happened since.
  config._accessTokenUsed = token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ---------------------------------------------------------------------------
// Global rate-limit handling: any 429 from anywhere in the dashboard surfaces a
// single, deduped toast that respects the server's Retry-After. Centralized
// here so every request — auth, data, uploads, downloads — behaves the same.
// ---------------------------------------------------------------------------

/** True when the error is an HTTP 429 (rate limited) — whether it's a raw axios
 *  error or one the api helpers wrapped in ApiError. Lets local handlers skip
 *  their generic error toast, since the global interceptor already shows one. */
export function isRateLimitError(error: unknown): boolean {
  if (axios.isAxiosError(error)) return error.response?.status === 429
  if (error instanceof ApiError) return error.status === 429
  return false
}

/** Parses Retry-After (delta-seconds or HTTP-date) into whole seconds, or null. */
export function getRetryAfterSeconds(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null
  const header = error.response?.headers?.['retry-after']
  if (header == null || header === '') return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds))
  const when = Date.parse(String(header))
  if (!Number.isNaN(when)) return Math.max(0, Math.round((when - Date.now()) / 1000))
  return null
}

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isRateLimitError(error)) {
      const wait = getRetryAfterSeconds(error)
      toast.warning(
        {
          title: 'Too many requests',
          message: wait
            ? `You're going a bit fast. Try again in ${wait}s.`
            : "You're going a bit fast. Please slow down and try again.",
        },
        // One rate-limit toast at a time; refresh its timer on repeats.
        { dedupeKey: 'rate-limited', duration: wait ? Math.min(wait * 1000, 10000) : undefined },
      )
    }
    return Promise.reject(error)
  },
)

/**
 * Reads `{ error }` from an axios error response, falling back to a default.
 * Connection/timeout failures always surface the friendly connection message
 * rather than a raw "Network Error" or the per-call fallback.
 */
function errorMessage(err: unknown, fallback: string): string {
  if (isConnectionError(err)) return CONNECTION_ERROR_MESSAGE
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: unknown } | undefined
    if (data && typeof data.error === 'string' && data.error) return data.error
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Single-flight refresh: only one /refresh may be in flight at a time, because
// the server rotates the refresh token on every use. Concurrent 401s all await
// the same promise and then retry with the one newly issued access token.
// ---------------------------------------------------------------------------
let refreshPromise: Promise<Auth> | null = null

async function performRefresh(): Promise<Auth> {
  const { data } = await http.post<Auth>(`${AUTH_PATH}/refresh`)
  setAccessToken(data.accessToken)
  return data
}

function refreshSession(): Promise<Auth> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// Response interceptor: the single place that turns a 401 into a refresh +
// one retry. It distinguishes a "stale token" 401 (a refresh already happened
// on another request) from a genuine one, so a late 401 never rotates the
// refresh token a second time.
http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error
    const original = error.config
    if (!original || error.response?.status !== 401) throw error
    // Never refresh for the auth endpoints themselves.
    if (isAuthEndpoint(original.url)) throw error
    // Each request gets at most one retry.
    if (original._authRetry) throw error
    original._authRetry = true

    const usedToken = original._accessTokenUsed
    const currentToken = getAccessToken()

    // A refresh already succeeded elsewhere — just retry with the fresh token,
    // do NOT call /refresh again.
    if (currentToken && usedToken !== currentToken) {
      original.headers.Authorization = `Bearer ${currentToken}`
      original._accessTokenUsed = currentToken
      return http.request(original)
    }

    // This request used the current token, so the token really is stale:
    // refresh once (single-flight) and retry.
    try {
      const refreshed = await refreshSession()
      original.headers.Authorization = `Bearer ${refreshed.accessToken}`
      original._accessTokenUsed = refreshed.accessToken
      return http.request(original)
    } catch {
      expireSession()
      throw error
    }
  },
)

/** Runs a request; refresh + retry-once on 401 is handled by the interceptor. */
async function request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  return http.request<T>(config)
}

export type BootstrapResult = Publisher | null

async function performBootstrap(): Promise<BootstrapResult> {
  // Migrate away from the legacy persisted blob — credentials must not persist.
  try {
    localStorage.removeItem('auth')
  } catch {
    // Ignore storage access errors.
  }
  try {
    const { publisher } = await refreshSession()
    return publisher
  } catch {
    setAccessToken(null)
    return null
  }
}

// Module-level shared bootstrap promise. React StrictMode runs the bootstrap
// effect twice in dev; sharing one promise means a single /refresh (and so a
// single refresh-token rotation). It clears on settle, so a later legitimate
// bootstrap (e.g. after logout + new login) can run again.
let bootstrapPromise: Promise<BootstrapResult> | null = null

/**
 * Restores the session on app start (and on demand). The refresh cookie is sent
 * automatically; on success the new access token is held in memory and the
 * publisher is returned, on failure the token is cleared and null is returned.
 * Idempotent across simultaneous callers via the shared bootstrap promise.
 */
export function bootstrapAuth(): Promise<BootstrapResult> {
  if (!bootstrapPromise) {
    bootstrapPromise = performBootstrap().finally(() => {
      bootstrapPromise = null
    })
  }
  return bootstrapPromise
}

/** Signs in a publisher, or returns a short-lived 2FA challenge when required. */
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const { data } = await http.post<Auth | TwoFactorChallenge>(`${AUTH_PATH}/login`, { email, password })
    if ('accessToken' in data) {
      setAccessToken(data.accessToken)
      return data.publisher
    }
    return data
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to sign in.'))
  }
}

export type RegisterPayload = {
  firstName: string
  lastName: string
  email: string
  password: string
  companyName: string
  websiteUrl: string
  contactType: ContactType
  contactValue: string
}

/** Creates a publisher account and signs in immediately (no 2FA on sign-up). */
export async function register(payload: RegisterPayload): Promise<Publisher> {
  try {
    const { data } = await http.post<Auth>(`${AUTH_PATH}/register`, payload)
    setAccessToken(data.accessToken)
    return data.publisher
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to create your account.'))
  }
}

/** Re-sends the email 2FA code for an active login challenge (email method only). */
export async function resendTwoFactorLoginCode(challengeToken: string): Promise<void> {
  try {
    await http.post(`${AUTH_PATH}/login/2fa/resend`, { challengeToken })
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to resend the code. Please try again.'))
  }
}

/** Completes a password-verified login with a 2FA code (authenticator or email). */
export async function verifyTwoFactorLogin(challengeToken: string, code: string): Promise<Publisher> {
  try {
    const { data } = await http.post<Auth>(`${AUTH_PATH}/login/2fa`, { challengeToken, code })
    setAccessToken(data.accessToken)
    return data.publisher
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to verify two-factor code.'))
  }
}

/** Requests a password-reset email. Always resolves (no account enumeration). */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await http.post(`${AUTH_PATH}/forgot-password`, { email })
  } catch (err) {
    throw new Error(errorMessage(err, 'Something went wrong. Please try again.'))
  }
}

/**
 * Completes a password reset using the token from the emailed link. The server
 * revokes all sessions on success, so the user must sign in again afterwards.
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  try {
    await http.post(`${AUTH_PATH}/reset-password`, { token, newPassword })
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to reset your password.'))
  }
}

/** Revokes the session server-side and clears the in-memory token. */
export async function signOut(): Promise<void> {
  try {
    await http.post(`${AUTH_PATH}/logout`)
  } catch {
    // Ignore network errors — clear locally regardless.
  }
  setAccessToken(null)
}

/** GETs a JSON resource from the API (Bearer token + refresh-on-401). */
export async function apiGet<T>(path: string, config: AxiosRequestConfig = {}): Promise<T> {
  try {
    const { data } = await request<T>({ ...config, method: 'GET', url: path })
    return data
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      expireSession()
      throw new Error('Session expired. Please sign in again.')
    }
    // Preserve the HTTP status (e.g. 429) so callers can detect rate limits.
    if (axios.isAxiosError(err)) {
      throw new ApiError(errorMessage(err, 'Unable to load data.'), err.response?.status ?? 0, err.response?.data)
    }
    throw new Error(errorMessage(err, 'Unable to load data.'))
  }
}

/** Downloads a protected file response with auth + refresh-on-401. */
export async function apiDownload(
  path: string,
  config: AxiosRequestConfig = {},
): Promise<{ blob: Blob; filename: string | null }> {
  try {
    const res = await request<Blob>({ ...config, method: 'GET', url: path, responseType: 'blob' })
    const disposition = (res.headers['content-disposition'] as string | undefined) ?? ''
    const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition)
    return { blob: res.data, filename: filenameMatch?.[1] ?? null }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      expireSession()
      throw new Error('Session expired. Please sign in again.')
    }
    throw new Error(errorMessage(err, 'Unable to download file.'))
  }
}

/** Uploads one protected file as multipart/form-data with auth + refresh-on-401. */
export async function apiUpload<T = unknown>(path: string, file: File): Promise<T> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const { data } = await request<T>({ method: 'POST', url: path, data: formData })
    return data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) {
        expireSession()
        throw new ApiError('Session expired. Please sign in again.', 401, null)
      }
      throw new ApiError(errorMessage(err, 'Upload failed.'), err.response?.status ?? 0, err.response?.data)
    }
    throw new ApiError('Upload failed.', 0, null)
  }
}

/** Error thrown by apiSend carrying the HTTP status and parsed response body. */
export class ApiError extends Error {
  status: number
  body: Record<string, unknown> | null
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
  }
}

/** Sends a mutating request (POST/PUT/PATCH/DELETE) with auth + refresh-on-401. */
export async function apiSend<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  try {
    const { data } = await request<T>({ method, url: path, data: body })
    return data
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) {
        expireSession()
        throw new ApiError('Session expired. Please sign in again.', 401, null)
      }
      throw new ApiError(errorMessage(err, 'Request failed.'), err.response?.status ?? 0, err.response?.data)
    }
    throw new ApiError('Request failed.', 0, null)
  }
}

export type BrowserSession = {
  id: number
  deviceName: string | null
  browserName: string | null
  osName: string | null
  ipAddress: string | null
  city: string | null
  country: string | null
  /** "City, Country" pre-composed by the API, or null when geo is unknown. */
  location: string | null
  lastUsedAt: string | null
  createdAt: string
  isCurrent: boolean
}

/** Lists the publisher's active browser sessions. */
export async function listSessions(): Promise<BrowserSession[]> {
  try {
    const { data } = await request<{ sessions: BrowserSession[] }>({
      method: 'GET',
      url: `${AUTH_PATH}/sessions`,
    })
    return data.sessions
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to load sessions.'))
  }
}

export type SessionRemovalChallenge = { maskedEmail: string; ttlMinutes: number }

/**
 * Requests the one-time email code required to remove a session. The code is
 * sent to the account email; the user supplies it to logoutOtherSessions /
 * revokeSession.
 */
export async function requestSessionRemovalCode(): Promise<SessionRemovalChallenge> {
  try {
    const { data } = await request<SessionRemovalChallenge>({
      method: 'POST',
      url: `${AUTH_PATH}/sessions/challenge`,
    })
    return { maskedEmail: data.maskedEmail, ttlMinutes: data.ttlMinutes }
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to send a verification code.'))
  }
}

/** Revokes every session except the current one. Requires a valid email code. */
export async function logoutOtherSessions(code: string): Promise<void> {
  try {
    await request({ method: 'POST', url: `${AUTH_PATH}/sessions/logout-others`, data: { code } })
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to sign out other sessions.'))
  }
}

/** Revokes a single session by id (cannot be the current session). Requires a valid email code. */
export async function revokeSession(id: number, code: string): Promise<void> {
  try {
    await request({ method: 'DELETE', url: `${AUTH_PATH}/sessions/${id}`, data: { code } })
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to revoke session.'))
  }
}

/**
 * Changes the signed-in publisher's password. On success the server revokes all
 * other sessions, keeping only this one alive.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await request({
      method: 'POST',
      url: `${AUTH_PATH}/change-password`,
      data: { currentPassword, newPassword },
    })
  } catch (err) {
    throw new Error(errorMessage(err, 'Unable to change password.'))
  }
}

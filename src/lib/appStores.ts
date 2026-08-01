// Resolves icons and search results for placements based on platform, using
// each platform's store API where one is available from the browser.

import axios from 'axios'

export type IconResult = string | null

/** A search result from an app store. */
export type StoreApp = {
  id: string
  name: string
  icon: string
  developer?: string
  domain?: string
}

export function faviconUrl(domain: string, size: number) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${Math.max(64, size * 2)}`
}

function hostOf(url?: string): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

// Google Play proxy (see /api/play and the dev plugin in vite.config.ts).
const PLAY_PROXY = (import.meta.env.VITE_PLAY_PROXY as string | undefined) || '/api/play'

type AppleResult = {
  trackId: number | string
  trackName: string
  artworkUrl100: string
  artistName: string
  sellerUrl?: string
  trackViewUrl?: string
}

/** Search the Apple App Store (iTunes Search API, CORS-enabled). */
export async function searchApple(term: string, signal?: AbortSignal): Promise<StoreApp[]> {
  if (!term.trim()) return []
  const { data } = await axios.get<{ results?: AppleResult[] }>('https://itunes.apple.com/search', {
    params: { term, entity: 'software', limit: 6 },
    signal,
  })
  return (data.results ?? []).map(
    (r): StoreApp => ({
      id: String(r.trackId),
      name: r.trackName,
      icon: r.artworkUrl100,
      developer: r.artistName,
      domain: hostOf(r.sellerUrl) ?? hostOf(r.trackViewUrl),
    }),
  )
}

/** Search Google Play through our proxy. */
export async function searchPlay(term: string, signal?: AbortSignal): Promise<StoreApp[]> {
  if (!term.trim()) return []
  const res = await axios.get<{
    results?: { appId: string; title: string; icon: string; developer: string; url?: string }[]
  }>(PLAY_PROXY, { params: { q: term }, signal })
  // If the proxy isn't running, the SPA fallback returns HTML — bail clearly.
  const contentType = String(res.headers['content-type'] ?? '')
  if (!contentType.includes('application/json')) {
    throw new Error(`Google Play search failed with status ${res.status}`)
  }
  const data = res.data
  return (data.results ?? []).map(
    (r): StoreApp => ({
      id: r.appId,
      name: r.title,
      icon: r.icon,
      developer: r.developer,
      domain: hostOf(r.url),
    }),
  )
}

/** Search the relevant store for a platform. */
export async function searchApps(platform: string, term: string, signal?: AbortSignal): Promise<StoreApp[]> {
  if (platform === 'iOS') return await searchApple(term, signal)
  if (platform === 'Android') return await searchPlay(term, signal)
  return []
}

/**
 * Resolves a website's page title via Microlink (a CORS-enabled third-party
 * metadata API), so the Web "Add app" flow can prefill a real name instead of
 * guessing from the domain. Returns null on any failure — callers fall back to
 * a domain-derived name. Pass an AbortSignal so stale lookups can be cancelled.
 *
 * Note: Microlink's free tier is rate-limited per IP; the caller debounces and
 * dedupes requests so we only ask once the domain settles.
 */
export async function fetchSiteTitle(domain: string, signal?: AbortSignal): Promise<string | null> {
  const term = domain.trim()
  if (!term) return null
  const url = /^https?:\/\//i.test(term) ? term : `https://${term}`
  const { data } = await axios.get<{ status?: string; data?: { title?: string; publisher?: string } }>(
    'https://api.microlink.io',
    { params: { url }, signal },
  )
  const title = data?.data?.title?.trim() || data?.data?.publisher?.trim()
  return title || null
}

type ResolveOpts = { name: string; domain: string; platform?: string; size: number }

/**
 * Returns an icon URL for a placement that has no explicit iconUrl, falling
 * back to the domain favicon. (Placements created via store search already
 * carry a real icon, so this is mainly for seeded/legacy data.)
 */
export async function resolveAppIcon({ name, domain, platform, size }: ResolveOpts): Promise<IconResult> {
  const fallback = domain ? faviconUrl(domain, size) : null
  try {
    if (platform === 'iOS') return (await searchApple(name))[0]?.icon ?? fallback
    if (platform === 'Android') return (await searchPlay(name))[0]?.icon ?? fallback
    return fallback // Web (and anything else): favicon.
  } catch {
    return fallback
  }
}

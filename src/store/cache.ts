export const CACHE_TTL = {
  'dashboard.stats': 60_000,
  'dashboard.revenueChart': 300_000,
  'dashboard.topOffers': 300_000,
  'dashboard.placements': 300_000,
  'dashboard.recentConversions': 120_000,
  'dashboard.countries': 300_000,
  'offers.list': 300_000,
  'conversions.list': 120_000,
  'payouts.list': 300_000,
  'placements.list': 60_000,
  'placements.overview': 60_000,
  'placements.config': 60_000,
  'placements.postback': 60_000,
  'placements.detail': 60_000,
  'placements.offers': 300_000,
  'placements.promotions': 120_000,
  reports: 300_000,
  settings: 600_000,
} as const

export const MAX_CACHE_ENTRIES = 20

export function isCacheFresh(lastFetched: number | null | undefined, ttlMs: number) {
  return Boolean(lastFetched && Date.now() - lastFetched < ttlMs)
}

export function hashParams(obj: Record<string, unknown> = {}) {
  const sorted = Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const value = obj[key]
      if (value !== undefined && value !== null && value !== '') acc[key] = value
      return acc
    }, {})

  const json = JSON.stringify(sorted)
  let hash = 0
  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 31 + json.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

export function cacheKeyFor(key: string, params?: Record<string, unknown>) {
  return `${key}:${hashParams(params)}`
}

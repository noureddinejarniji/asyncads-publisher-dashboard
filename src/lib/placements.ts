// Shared placement-related types. Data now comes from the API (see the
// `/api/placements*` endpoints) via the Redux cache — there is no local store.

export type PostbackParam = { key: string; value: string; required: boolean }

export type Promotion = {
  id: number
  name: string
  boostType: 'percent' | 'multiplier'
  boostValue: number
  appliesTo: string // offer category name or "All offers"
  message?: string | null // optional banner text
  bannerImage?: string | null // optional uploaded banner image URL
  startsAt: string
  endsAt: string
  enabled: boolean
}

export type Placement = {
  slug: string
  publicId: string
  name: string
  platform: string // 'ios' | 'android' | 'web'
  domain: string | null
  iconUrl?: string | null
  status: string // 'draft' | 'pending_review' | 'live' | 'paused' | 'archived'
  rewardCurrencyName?: string
  exchangeRate?: number
}

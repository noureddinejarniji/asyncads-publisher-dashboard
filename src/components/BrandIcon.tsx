import { useEffect, useState } from 'react'
import { faviconUrl, resolveAppIcon } from '../lib/appStores'

type Props = { name: string; domain: string; platform?: string; iconUrl?: string; size?: number }

/**
 * Brand/app icon. Uses an explicit iconUrl when provided (e.g. picked via store
 * search); otherwise resolves per platform — iOS App Store artwork, Android Play
 * icon, Web favicon — falling back to a gradient initial tile.
 */
export default function BrandIcon({ name, domain, platform, iconUrl, size = 40 }: Props) {
  const isStore = platform === 'iOS' || platform === 'Android'
  const fallback = iconUrl ?? (isStore ? null : domain ? faviconUrl(domain, size) : null)
  // Resolved/failed state is keyed to the current props, so prop changes
  // implicitly reset both without any synchronous setState in an effect.
  const key = `${name}|${domain}|${platform ?? ''}|${iconUrl ?? ''}|${size}`
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)

  useEffect(() => {
    if (iconUrl) return
    let cancelled = false
    resolveAppIcon({ name, domain, platform, size }).then((url) => {
      if (!cancelled) setResolved({ key, url })
    })
    return () => {
      cancelled = true
    }
  }, [key, name, domain, platform, iconUrl, size])

  const src = iconUrl ?? (resolved?.key === key ? resolved.url : fallback)
  const failed = failedKey === key

  const style = { width: size, height: size }

  if (failed || !src) {
    return (
      <span
        style={style}
        className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-violet to-brand-fuchsia font-semibold text-white"
      >
        {name.charAt(0)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      style={style}
      referrerPolicy="no-referrer"
      onError={() => setFailedKey(key)}
      className="shrink-0 rounded-xl border border-slate-200 bg-white object-cover"
    />
  )
}

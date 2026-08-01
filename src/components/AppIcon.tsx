import { useState } from 'react'

type Rounded = 'lg' | 'xl' | '2xl' | 'full'

const ROUNDED: Record<Rounded, string> = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
}

type Props = {
  /** Icon image URL. When absent or it fails to load, a gradient initial is shown. */
  src?: string | null
  /** Used for the alt text and the fallback initial. */
  name?: string
  size?: number
  rounded?: Rounded
  /** Adds a subtle border + white background (nice for transparent/favicon art). */
  bordered?: boolean
  className?: string
}

/**
 * Presentational app/brand icon. Renders the given image and degrades to a
 * gradient initial tile if no URL is provided or the image fails to load.
 *
 * For platform-aware icon *resolution* (App Store / Play / favicon lookups),
 * use BrandIcon, which builds on this primitive.
 */
export default function AppIcon({
  src,
  name = '',
  size = 40,
  rounded = 'xl',
  bordered = true,
  className = '',
}: Props) {
  const [failed, setFailed] = useState(false)
  // Reset the error state if the source changes (e.g. list item re-use) —
  // adjusted during render instead of in an effect.
  const [prevSrc, setPrevSrc] = useState(src)
  if (prevSrc !== src) {
    setPrevSrc(src)
    setFailed(false)
  }

  const radius = ROUNDED[rounded]
  const style = { width: size, height: size }
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  if (!src || failed) {
    return (
      <span
        style={{ ...style, fontSize: Math.round(size * 0.42) }}
        aria-label={name || undefined}
        className={`grid shrink-0 place-items-center bg-gradient-to-br from-brand-violet to-brand-fuchsia font-semibold leading-none text-white ${radius} ${className}`}
      >
        {initial}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${radius} ${
        bordered ? 'border border-slate-200 bg-white' : ''
      } ${className}`}
    />
  )
}

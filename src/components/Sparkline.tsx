import { memo } from 'react'

type SparklineProps = {
  values: number[]
  up?: boolean
}

export const Sparkline = memo(function Sparkline({ values, up = true }: SparklineProps) {
  if (!values || values.length === 0) return null

  const width = 110
  const height = 36
  const padding = 4

  let points: string
  if (values.length === 1) {
    // Single point: render a flat horizontal line centered vertically
    points = `${padding},${height / 2} ${width - padding},${height / 2}`
  } else {
    const maxX = values.length - 1
    const minY = Math.min(...values)
    const maxY = Math.max(...values)
    const allEqual = minY === maxY

    points = values
      .map((val, i) => {
        const x = padding + (i / maxX) * (width - padding * 2)
        const y = allEqual
          ? height / 2
          : height - padding - ((val - minY) / (maxY - minY)) * (height - padding * 2)
        return `${x},${y}`
      })
      .join(' ')
  }

  const color = up ? '#10b981' : '#ef4444'

  return (
    <svg width={width} height={height} className="overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
})

export default Sparkline

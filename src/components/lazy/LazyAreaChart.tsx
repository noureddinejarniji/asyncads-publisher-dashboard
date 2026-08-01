import { Suspense, lazy } from 'react'
import InlineSpinner from '../InlineSpinner'
import type { ChartKind, SeriesVisibility } from '../Charts'

type Point = { label: string; value: number; clicks?: number; conversions?: number; users?: number; impressions?: number }

type LazyAreaChartProps = {
  data: Point[]
  height?: number
  visible?: SeriesVisibility
  type?: ChartKind
  smooth?: boolean
}

const AreaChartImpl = lazy(() => import('../Charts').then((module) => ({ default: module.AreaChart })))

export default function LazyAreaChart({ data, height, visible, type, smooth }: LazyAreaChartProps) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[280px] items-center justify-center">
          <InlineSpinner />
        </div>
      }
    >
      <AreaChartImpl data={data} height={height} visible={visible} type={type} smooth={smooth} />
    </Suspense>
  )
}

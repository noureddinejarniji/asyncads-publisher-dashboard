import { ArrowLeftRight, CheckCircle2, Coins, CreditCard, DollarSign, Layers, MousePointerClick, Percent, Timer, TrendingUp, Undo2, Users, XCircle } from 'lucide-react'
import ReportTable, { type ReportColumn } from '../components/ReportTable'
import BrandIcon from '../components/BrandIcon'

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Build a {label,value} series ending today, one point per day. */
function toSeries(values: number[]) {
  const today = new Date()
  return values.map((value, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (values.length - 1 - i))
    return { label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, value }
  })
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    /deliver|credit|active/i.test(status)
      ? 'bg-emerald-50 text-emerald-600'
      : /fail|revers|chargeback/i.test(status)
        ? 'bg-red-50 text-red-500'
        : 'bg-amber-50 text-amber-600'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>
}

const offerCell = (name: string, domain: string) => (
  <div className="flex min-w-0 items-center gap-2.5">
    <BrandIcon name={name} domain={domain} size={32} />
    <span className="min-w-0 truncate text-sm font-medium text-slate-900">{name}</span>
  </div>
)

/* ----------------------------- Reversals ----------------------------- */

type Reversal = { id: string; user: string; offer: string; domain: string; reason: string; amount: number; status: string }
const REVERSALS: Reversal[] = [
  { id: 'r1', user: 'user_b32f', offer: 'Stake', domain: 'stake.com', reason: 'Fraudulent activity', amount: 7.0, status: 'Reversed' },
  { id: 'r2', user: 'user_3a1d', offer: 'Cash App', domain: 'cash.app', reason: 'Chargeback', amount: 6.0, status: 'Chargeback' },
  { id: 'r3', user: 'user_88fa', offer: 'Temu', domain: 'temu.com', reason: 'Duplicate conversion', amount: 4.0, status: 'Reversed' },
  { id: 'r4', user: 'user_0c2b', offer: 'Coin Master', domain: 'coinmaster.com', reason: 'Refund issued', amount: 5.0, status: 'Chargeback' },
]

export function ReversalsReport() {
  const total = REVERSALS.reduce((s, r) => s + r.amount, 0)
  const chargebacks = REVERSALS.filter((r) => r.status === 'Chargeback').length
  const columns: ReportColumn<Reversal>[] = [
    { header: 'User', span: 3, render: (r) => <span className="truncate font-mono text-sm text-slate-700">{r.user}</span> },
    { header: 'Offer', span: 3, render: (r) => offerCell(r.offer, r.domain) },
    { header: 'Reason', span: 2, render: (r) => <span className="truncate text-sm text-slate-600">{r.reason}</span> },
    { header: 'Amount', span: 2, align: 'right', render: (r) => <span className="text-sm font-semibold text-red-500">-{usd(r.amount)}</span> },
    { header: 'Status', span: 2, align: 'right', render: (r) => <StatusBadge status={r.status} /> },
  ]
  return (
    <ReportTable
      title="Reversals"
      description="Reversed or invalidated conversions and chargebacks."
      stats={[
        { label: 'Reversals', value: String(REVERSALS.length), icon: Undo2 },
        { label: 'Amount reversed', value: usd(total), icon: DollarSign },
        { label: 'Chargebacks', value: String(chargebacks), icon: CreditCard },
        { label: 'Reversal rate', value: '1.8%', icon: Percent },
      ]}
      chart={{ label: 'Reversals over time', data: toSeries([3, 5, 2, 6, 4, 7, 5]) }}
      columns={columns}
      rows={REVERSALS}
      rowKey={(r) => r.id}
      searchPlaceholder="Search user or offer..."
      matchesSearch={(r, q) => r.user.toLowerCase().includes(q) || r.offer.toLowerCase().includes(q)}
      statuses={['All', 'Reversed', 'Chargeback']}
      getStatus={(r) => r.status}
    />
  )
}

/* ----------------------------- Postbacks ----------------------------- */

type Postback = { id: string; time: string; event: string; url: string; code: number; attempts: number; status: string }
const POSTBACKS: Postback[] = [
  { id: 'p1', time: '2 min ago', event: 'conversion', url: '/asyncads/postback?user_id=8f2a', code: 200, attempts: 1, status: 'Delivered' },
  { id: 'p2', time: '6 min ago', event: 'conversion', url: '/asyncads/postback?user_id=1c9b', code: 200, attempts: 1, status: 'Delivered' },
  { id: 'p3', time: '12 min ago', event: 'reversal', url: '/asyncads/postback?user_id=b32f', code: 500, attempts: 3, status: 'Failed' },
  { id: 'p4', time: '20 min ago', event: 'conversion', url: '/asyncads/postback?user_id=4a01', code: 429, attempts: 2, status: 'Retrying' },
]

export function PostbacksReport() {
  const delivered = POSTBACKS.filter((p) => p.status === 'Delivered').length
  const failed = POSTBACKS.filter((p) => p.status === 'Failed').length
  const columns: ReportColumn<Postback>[] = [
    { header: 'Time', span: 2, render: (p) => <span className="text-sm text-slate-500">{p.time}</span> },
    { header: 'Event', span: 2, render: (p) => <span className="text-sm text-slate-700 capitalize">{p.event}</span> },
    { header: 'Endpoint', span: 4, render: (p) => <span className="truncate font-mono text-xs text-slate-500">{p.url}</span> },
    { header: 'Code', span: 1, align: 'right', render: (p) => <span className={`font-mono text-sm font-semibold ${p.code < 300 ? 'text-emerald-600' : 'text-red-500'}`}>{p.code}</span> },
    { header: 'Tries', span: 1, align: 'right', render: (p) => <span className="text-sm text-slate-600">{p.attempts}</span> },
    { header: 'Status', span: 2, align: 'right', render: (p) => <StatusBadge status={p.status} /> },
  ]
  return (
    <ReportTable
      title="Postbacks"
      description="Server-to-server callback delivery log and statuses."
      stats={[
        { label: 'Delivered', value: String(delivered), icon: CheckCircle2 },
        { label: 'Failed', value: String(failed), icon: XCircle },
        { label: 'Success rate', value: '96.4%', icon: ArrowLeftRight },
        { label: 'Avg latency', value: '142 ms', icon: Timer },
      ]}
      chart={{ label: 'Deliveries over time', data: toSeries([920, 1040, 980, 1120, 1080, 1180, 1240]) }}
      columns={columns}
      rows={POSTBACKS}
      rowKey={(p) => p.id}
      searchPlaceholder="Search endpoint..."
      matchesSearch={(p, q) => p.url.toLowerCase().includes(q) || p.event.toLowerCase().includes(q)}
      statuses={['All', 'Delivered', 'Failed', 'Retrying']}
      getStatus={(p) => p.status}
    />
  )
}

/* ----------------------------- Revenue ----------------------------- */

type RevenueRow = { id: string; placement: string; conversions: number; revenue: number; ecpm: number }
const REVENUE: RevenueRow[] = [
  { id: 'rv1', placement: 'Puzzle Quest', conversions: 4210, revenue: 18420, ecpm: 16.2 },
  { id: 'rv2', placement: 'Daily Rewards', conversions: 2980, revenue: 12090, ecpm: 14.8 },
  { id: 'rv3', placement: 'Cash Spin', conversions: 2210, revenue: 9640, ecpm: 13.1 },
  { id: 'rv4', placement: 'Trivia Star', conversions: 980, revenue: 5310, ecpm: 11.4 },
]

export function RevenueReport() {
  const total = REVENUE.reduce((s, r) => s + r.revenue, 0)
  const conv = REVENUE.reduce((s, r) => s + r.conversions, 0)
  const columns: ReportColumn<RevenueRow>[] = [
    { header: 'Placement', span: 5, render: (r) => <span className="truncate text-sm font-medium text-slate-900">{r.placement}</span> },
    { header: 'Conversions', span: 2, align: 'right', render: (r) => <span className="text-sm text-slate-600">{r.conversions.toLocaleString()}</span> },
    { header: 'Revenue', span: 3, align: 'right', render: (r) => <span className="text-sm font-semibold text-slate-900">{usd(r.revenue)}</span> },
    { header: 'eCPM', span: 2, align: 'right', render: (r) => <span className="text-sm text-slate-600">{usd(r.ecpm)}</span> },
  ]
  return (
    <ReportTable
      title="Revenue"
      description="Earnings, eCPM, and payouts by placement."
      stats={[
        { label: 'Revenue', value: usd(total), icon: DollarSign },
        { label: 'Conversions', value: conv.toLocaleString(), icon: CheckCircle2 },
        { label: 'Avg eCPM', value: usd(13.9), icon: TrendingUp },
        { label: 'Pending payout', value: usd(1840.2), icon: Coins },
      ]}
      chart={{ label: 'Revenue over time', data: toSeries([3010, 2650, 3120, 3380, 3100, 3520, 4120]) }}
      columns={columns}
      rows={REVENUE}
      rowKey={(r) => r.id}
      searchPlaceholder="Search placement..."
      matchesSearch={(r, q) => r.placement.toLowerCase().includes(q)}
    />
  )
}

/* ----------------------------- Clicks ----------------------------- */

type ClickRow = { id: string; placement: string; clicks: number; uniques: number; conversions: number; ctr: string }
const CLICKS: ClickRow[] = [
  { id: 'k1', placement: 'Puzzle Quest', clicks: 84210, uniques: 23107, conversions: 4210, ctr: '5.0%' },
  { id: 'k2', placement: 'Daily Rewards', clicks: 60100, uniques: 18420, conversions: 2980, ctr: '5.0%' },
  { id: 'k3', placement: 'Cash Spin', clicks: 48700, uniques: 14010, conversions: 2210, ctr: '4.5%' },
  { id: 'k4', placement: 'Trivia Star', clicks: 21300, uniques: 7640, conversions: 980, ctr: '4.6%' },
]

export function ClicksReport() {
  const clicks = CLICKS.reduce((s, r) => s + r.clicks, 0)
  const uniques = CLICKS.reduce((s, r) => s + r.uniques, 0)
  const conv = CLICKS.reduce((s, r) => s + r.conversions, 0)
  const columns: ReportColumn<ClickRow>[] = [
    { header: 'Placement', span: 4, render: (r) => <span className="truncate text-sm font-medium text-slate-900">{r.placement}</span> },
    { header: 'Clicks', span: 2, align: 'right', render: (r) => <span className="text-sm text-slate-600">{r.clicks.toLocaleString()}</span> },
    { header: 'Unique', span: 2, align: 'right', render: (r) => <span className="text-sm text-slate-600">{r.uniques.toLocaleString()}</span> },
    { header: 'Conversions', span: 2, align: 'right', render: (r) => <span className="text-sm text-slate-600">{r.conversions.toLocaleString()}</span> },
    { header: 'CTR', span: 2, align: 'right', render: (r) => <span className="text-sm font-semibold text-slate-900">{r.ctr}</span> },
  ]
  return (
    <ReportTable
      title="Clicks & traffic"
      description="Offer impressions and click-through by placement."
      stats={[
        { label: 'Clicks', value: clicks.toLocaleString(), icon: MousePointerClick },
        { label: 'Unique users', value: uniques.toLocaleString(), icon: Users },
        { label: 'Conversions', value: conv.toLocaleString(), icon: CheckCircle2 },
        { label: 'Avg CTR', value: '4.8%', icon: Percent },
      ]}
      chart={{ label: 'Clicks over time', data: toSeries([28000, 31000, 29500, 34000, 33000, 36500, 41000]) }}
      columns={columns}
      rows={CLICKS}
      rowKey={(r) => r.id}
      searchPlaceholder="Search placement..."
      matchesSearch={(r, q) => r.placement.toLowerCase().includes(q)}
    />
  )
}

/* ----------------------------- Offer performance ----------------------------- */

type OfferRow = { id: string; offer: string; domain: string; category: string; conversions: number; revenue: number; ecpm: number }
const OFFERS: OfferRow[] = [
  { id: 'o1', offer: 'Coin Master', domain: 'coinmaster.com', category: 'Mobile game', conversions: 1842, revenue: 9210, ecpm: 18.4 },
  { id: 'o2', offer: 'Survey Junkie', domain: 'surveyjunkie.com', category: 'Survey', conversions: 1320, revenue: 6604, ecpm: 15.1 },
  { id: 'o3', offer: 'Cash App', domain: 'cash.app', category: 'Sign-up', conversions: 980, revenue: 5880, ecpm: 22.0 },
  { id: 'o4', offer: 'Temu', domain: 'temu.com', category: 'Install', conversions: 760, revenue: 3040, ecpm: 9.8 },
  { id: 'o5', offer: 'Stake', domain: 'stake.com', category: 'Deposit', conversions: 410, revenue: 2870, ecpm: 27.5 },
]

export function OffersReport() {
  const conv = OFFERS.reduce((s, r) => s + r.conversions, 0)
  const revenue = OFFERS.reduce((s, r) => s + r.revenue, 0)
  const columns: ReportColumn<OfferRow>[] = [
    { header: 'Offer', span: 4, render: (r) => offerCell(r.offer, r.domain) },
    { header: 'Category', span: 2, render: (r) => <span className="truncate text-sm text-slate-500">{r.category}</span> },
    { header: 'Conversions', span: 2, align: 'right', render: (r) => <span className="text-sm text-slate-600">{r.conversions.toLocaleString()}</span> },
    { header: 'Revenue', span: 2, align: 'right', render: (r) => <span className="text-sm font-semibold text-slate-900">{usd(r.revenue)}</span> },
    { header: 'eCPM', span: 2, align: 'right', render: (r) => <span className="text-sm text-slate-600">{usd(r.ecpm)}</span> },
  ]
  return (
    <ReportTable
      title="Offer performance"
      description="Conversion and revenue breakdown by offer."
      stats={[
        { label: 'Active offers', value: String(OFFERS.length), icon: Layers },
        { label: 'Conversions', value: conv.toLocaleString(), icon: CheckCircle2 },
        { label: 'Revenue', value: usd(revenue), icon: DollarSign },
        { label: 'Top offer', value: 'Coin Master', icon: TrendingUp },
      ]}
      chart={{ label: 'Conversions over time', data: toSeries([720, 810, 760, 880, 840, 920, 980]) }}
      columns={columns}
      rows={OFFERS}
      rowKey={(r) => r.id}
      searchPlaceholder="Search offer or category..."
      matchesSearch={(r, q) => r.offer.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)}
    />
  )
}

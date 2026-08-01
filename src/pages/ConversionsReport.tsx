import { CheckCircle2, Clock, Coins, DollarSign, MousePointerClick, Undo2, type LucideIcon as Icon } from 'lucide-react'
import ReportTable, { type ReportColumn } from '../components/ReportTable'
import BrandIcon from '../components/BrandIcon'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function toSeries(values: number[]) {
  const today = new Date()
  return values.map((value, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (values.length - 1 - i))
    return { label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, value }
  })
}

type Status = 'Credited' | 'Pending' | 'Reversed'
type Conversion = {
  id: string
  user: string
  offer: string
  domain: string
  placement: string
  payout: number
  time: string
  status: Status
}

const DATA: Conversion[] = [
  { id: 'c1', user: 'user_8f2a', offer: 'Coin Master', domain: 'coinmaster.com', placement: 'Puzzle Quest', payout: 5.0, time: '2 min ago', status: 'Credited' },
  { id: 'c2', user: 'user_1c9b', offer: 'Survey Junkie', domain: 'surveyjunkie.com', placement: 'Daily Rewards', payout: 5.0, time: '6 min ago', status: 'Credited' },
  { id: 'c3', user: 'user_77de', offer: 'Cash App', domain: 'cash.app', placement: 'Cash Spin', payout: 6.0, time: '11 min ago', status: 'Pending' },
  { id: 'c4', user: 'user_4a01', offer: 'Temu', domain: 'temu.com', placement: 'Puzzle Quest', payout: 4.0, time: '18 min ago', status: 'Credited' },
  { id: 'c5', user: 'user_b32f', offer: 'Stake', domain: 'stake.com', placement: 'Trivia Star', payout: 7.0, time: '24 min ago', status: 'Reversed' },
  { id: 'c6', user: 'user_2d8e', offer: 'Coin Master', domain: 'coinmaster.com', placement: 'Daily Rewards', payout: 5.0, time: '38 min ago', status: 'Credited' },
  { id: 'c7', user: 'user_5a6c', offer: 'MISTPLAY', domain: 'mistplay.com', placement: 'Cash Spin', payout: 3.5, time: '1 hr ago', status: 'Pending' },
  { id: 'c8', user: 'user_9b3f', offer: 'Survey Junkie', domain: 'surveyjunkie.com', placement: 'Puzzle Quest', payout: 5.0, time: '2 hr ago', status: 'Credited' },
]

const STATUS_TONE: Record<Status, { tone: string; icon: Icon }> = {
  Credited: { tone: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
  Pending: { tone: 'bg-amber-50 text-amber-600', icon: Clock },
  Reversed: { tone: 'bg-red-50 text-red-500', icon: Undo2 },
}

const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

export default function ConversionsReport() {
  const revenue = DATA.reduce((s, c) => s + (c.status !== 'Reversed' ? c.payout : 0), 0)
  const credited = DATA.filter((c) => c.status === 'Credited').length
  const avg = DATA.length ? revenue / DATA.length : 0

  const columns: ReportColumn<Conversion>[] = [
    {
      header: 'User',
      span: 3,
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-slate-700">{c.user}</p>
          <p className="text-xs text-slate-400">{c.time}</p>
        </div>
      ),
    },
    {
      header: 'Offer',
      span: 4,
      render: (c) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandIcon name={c.offer} domain={c.domain} size={32} />
          <span className="min-w-0 truncate text-sm font-medium text-slate-900">{c.offer}</span>
        </div>
      ),
    },
    { header: 'Placement', span: 2, render: (c) => <span className="truncate text-sm text-slate-600">{c.placement}</span> },
    { header: 'Payout', span: 1, align: 'right', render: (c) => <span className="text-sm font-semibold text-slate-900">{usd(c.payout)}</span> },
    {
      header: 'Status',
      span: 2,
      align: 'right',
      render: (c) => {
        const s = STATUS_TONE[c.status]
        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.tone}`}>
            <s.icon size={12} />
            {c.status}
          </span>
        )
      },
    },
  ]

  return (
    <ReportTable
      title="Conversions"
      description="Completed offers and rewards granted to your users."
      stats={[
        { label: 'Conversions', value: DATA.length.toLocaleString(), icon: MousePointerClick },
        { label: 'Credited', value: credited.toLocaleString(), icon: CheckCircle2 },
        { label: 'Revenue', value: usd(revenue), icon: DollarSign },
        { label: 'Avg payout', value: usd(avg), icon: Coins },
      ]}
      chart={{ label: 'Conversions over time', data: toSeries([980, 1120, 1040, 1280, 1180, 1340, 1510]) }}
      columns={columns}
      rows={DATA}
      rowKey={(c) => c.id}
      searchPlaceholder="Search user or offer..."
      matchesSearch={(c, q) => c.user.toLowerCase().includes(q) || c.offer.toLowerCase().includes(q)}
      statuses={['All', 'Credited', 'Pending', 'Reversed']}
      getStatus={(c) => c.status}
    />
  )
}

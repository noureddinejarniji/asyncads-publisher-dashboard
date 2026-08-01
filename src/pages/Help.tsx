import { useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronRight, LayoutGrid, type LucideProps, Mail, MessageSquare, PieChart, ShieldCheck, Wallet } from 'lucide-react'

const SUPPORT_EMAIL = 'support@asyncads.com'
const MANAGER = {
  name: 'Sarah Klein',
  role: 'Your account manager',
  email: 'sarah@asyncads.com',
  teams: 'https://teams.microsoft.com/l/chat/0/0?users=sarah@asyncads.com',
  initials: 'SK',
}

const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50'

type Topic = { icon: ComponentType<LucideProps>; title: string; body: string; to: string }

const TOPICS: Topic[] = [
  { icon: BookOpen, title: 'Set up your integration', body: 'Embed the offerwall, wire S2S postbacks, and call the offers API.', to: '/docs' },
  { icon: LayoutGrid, title: 'Manage placements', body: 'Create a placement, submit it for review, and find your IDs.', to: '/placements' },
  { icon: PieChart, title: 'Track performance', body: 'Revenue, conversions, and eCPM across your placements.', to: '/reports' },
  { icon: Wallet, title: 'Get paid', body: 'Check your balance, payment history, and thresholds.', to: '/payment' },
]

type Faq = { q: string; a: ReactNode }

const FAQS: Faq[] = [
  {
    q: 'How do I create a placement?',
    a: (
      <>
        Open <FaqLink to="/placements">Placements</FaqLink> and click <b>New placement</b>. It starts as a{' '}
        <Code>draft</Code> — submit it for review, and once AsyncAds accepts it you can configure offers, S2S, and
        promotions, then go live. See the <FaqLink to="/docs">integration guide</FaqLink> for the full walkthrough.
      </>
    ),
  },
  {
    q: "Why can't I configure my placement yet?",
    a: (
      <>
        A placement must be accepted before it can be configured. While it's in <Code>draft</Code> or{' '}
        <Code>pending review</Code>, its offers, S2S, and promotions stay locked — they unlock automatically as soon as
        the placement is approved.
      </>
    ),
  },
  {
    q: 'How do server-to-server (S2S) postbacks work?',
    a: (
      <>
        When a user completes an offer, AsyncAds sends a request to your callback URL. Validate the HMAC-SHA256{' '}
        <Code>signature</Code>, then reply with exactly <Code>1</Code> to accept the conversion (or <Code>0</Code> to
        reject it). Remember to whitelist our server IP. Full details and a PHP example are in the{' '}
        <FaqLink to="/docs">developer docs</FaqLink>.
      </>
    ),
  },
  {
    q: 'How do promotions work?',
    a: (
      <>
        Promotions are time-bound reward boosts for a placement (a percentage or a multiplier). Only{' '}
        <b>one promotion can be active at a time</b> — activating one automatically pauses the others. Open a
        placement's configuration to create or schedule one.
      </>
    ),
  },
  {
    q: 'Where do I find my placement ID?',
    a: (
      <>
        Open a placement from <FaqLink to="/placements">Placements</FaqLink>. Its public ID and numeric ID appear next
        to the name — use the copy button beside either one.
      </>
    ),
  },
  {
    q: 'When do I get paid?',
    a: (
      <>
        Your balance and payment history live on the <FaqLink to="/payment">Payment</FaqLink> page. Payouts are issued on
        your agreed schedule once you pass the minimum threshold.
      </>
    ),
  },
]

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-700">{children}</code>
}

function FaqLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-brand-fuchsia transition-colors hover:text-brand-violet">
      {children}
    </Link>
  )
}

function FaqItem({ faq, open, onToggle }: { faq: Faq; open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50"
      >
        <span className="text-[15px] font-semibold text-slate-900">{faq.q}</span>
        <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-4 text-sm leading-7 text-slate-600">{faq.a}</p>}
    </div>
  )
}

export default function Help() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Help &amp; support</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">How can we help?</h1>
        <p className="mt-2 max-w-2xl text-slate-500">
          Browse common topics, find quick answers below, or reach our team directly — we usually reply within a few
          hours.
        </p>
      </header>

      {/* Topic shortcuts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TOPICS.map((t) => (
          <Link
            key={t.title}
            to={t.to}
            className={`group flex items-center gap-4 p-4 transition-all hover:-translate-y-0.5 hover:border-brand-fuchsia/30 hover:shadow-md hover:shadow-brand-fuchsia/5 ${CARD}`}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-fuchsia/10 text-brand-fuchsia transition-colors group-hover:bg-brand-fuchsia group-hover:text-white">
              <t.icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-slate-900">{t.title}</span>
              <span className="mt-0.5 block text-sm leading-5 text-slate-500">{t.body}</span>
            </span>
            <ChevronRight
              size={18}
              className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-fuchsia"
            />
          </Link>
        ))}
      </div>

      {/* FAQ */}
      <h2 className="mb-3 mt-10 font-display text-xl font-bold tracking-tight text-slate-900">Frequently asked</h2>
      <div className={`divide-y divide-slate-100 overflow-hidden ${CARD}`}>
        {FAQS.map((faq, i) => (
          <FaqItem key={faq.q} faq={faq} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
        ))}
      </div>

      {/* Contact */}
      <h2 className="mb-3 mt-10 font-display text-xl font-bold tracking-tight text-slate-900">Still need a hand?</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`flex items-center gap-3 p-4 ${CARD}`}>
          <div className="relative shrink-0">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-violet to-brand-fuchsia text-sm font-bold text-white">
              {MANAGER.initials}
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-slate-900">{MANAGER.name}</p>
            <p className="truncate text-xs text-slate-400">{MANAGER.role}</p>
          </div>
          <a
            href={MANAGER.teams}
            target="_blank"
            rel="noreferrer"
            title="Message on Teams"
            aria-label={`Message ${MANAGER.name} on Teams`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-fuchsia text-white transition-colors hover:bg-brand-fuchsia/90"
          >
            <MessageSquare size={16} />
          </a>
        </div>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className={`group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:border-brand-fuchsia/30 hover:shadow-md hover:shadow-brand-fuchsia/5 ${CARD}`}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-brand-fuchsia/10 group-hover:text-brand-fuchsia">
            <Mail size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-slate-900">Email support</span>
            <span className="mt-0.5 block truncate text-sm text-slate-500">{SUPPORT_EMAIL}</span>
          </span>
        </a>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <ShieldCheck size={18} className="shrink-0 text-slate-400" />
        <p className="text-sm text-slate-500">
          Looking for legal documents? See our{' '}
          <Link to="/legal/terms" className="font-medium text-brand-fuchsia hover:text-brand-violet">
            Terms, Privacy, DPA and Cookie Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

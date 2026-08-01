import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

const CARD = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8'

const TABS = [
  { to: '/legal/terms', label: 'Terms' },
  { to: '/legal/privacy', label: 'Privacy' },
  { to: '/legal/dpa', label: 'DPA' },
  { to: '/legal/cookies', label: 'Cookie Policy' },
]

export type LegalSection = { heading: string; body: ReactNode }

/** Styled paragraph for legal copy. */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-slate-600">{children}</p>
}

/** Bulleted list for legal copy. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

type Props = {
  title: string
  updated: string
  intro: ReactNode
  sections: LegalSection[]
}

/** Shared layout for the legal documents (terms, privacy, DPA, cookies). */
export default function LegalDoc({ title, updated, intro, sections }: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">Last updated {updated}</p>
      </div>

      {/* Cross-navigation between legal documents */}
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-fuchsia/10 text-brand-fuchsia'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className={CARD}>
        <div className="mb-8 border-b border-slate-100 pb-6">
          <P>{intro}</P>
        </div>

        <div className="space-y-8">
          {sections.map((s, i) => (
            <section key={s.heading}>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {i + 1}. {s.heading}
              </h2>
              <div className="mt-3 space-y-3">{s.body}</div>
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-slate-100 pt-6 text-sm leading-7 text-slate-500">
          Questions about this document? Contact us at{' '}
          <a href="mailto:legal@asyncads.com" className="font-medium text-brand-fuchsia hover:text-brand-violet">
            legal@asyncads.com
          </a>
          .
        </p>
      </div>
    </div>
  )
}

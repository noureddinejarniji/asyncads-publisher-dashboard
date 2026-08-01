import { Wrench } from 'lucide-react'

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-fuchsia/10 text-brand-fuchsia">
          <Wrench size={24} />
        </span>
        <p className="font-medium text-slate-900">{title} coming soon</p>
        <p className="max-w-sm text-sm text-slate-500">
          This section is under construction. Check back shortly.
        </p>
      </div>
    </div>
  )
}

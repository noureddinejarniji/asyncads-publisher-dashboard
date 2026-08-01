import { LoaderCircle } from 'lucide-react'

type InlineSpinnerProps = {
  className?: string
}

export default function InlineSpinner({ className = '' }: InlineSpinnerProps) {
  return <LoaderCircle size={16} className={`inline-block animate-spin text-brand-fuchsia ${className}`} />
}


import { getStatusBadge } from '../../utils/formatters'

export interface StatusPillProps {
  status: string
  size?: 'sm' | 'md'
  className?: string
}

export function StatusPill({ status, size = 'sm', className = '' }: StatusPillProps) {
  const config = getStatusBadge(status)
  const isSm = size === 'sm'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border whitespace-nowrap shrink-0 ${config.bg} ${config.text} ${config.border} ${
        isSm ? 'text-[11px] px-2.5 py-0.5' : 'text-xs px-3 py-1'
      } ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  )
}

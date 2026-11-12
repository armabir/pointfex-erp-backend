import type { ReactNode, ComponentType, MouseEventHandler } from 'react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'brand'
  | 'lime'
  | 'subtle'
  | 'outline'
  | string

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | string

export interface ButtonProps {
  children?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ComponentType<{ className?: string }>
  rightIcon?: ComponentType<{ className?: string }>
  className?: string
  disabled?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit' | 'reset'
  title?: string
  'aria-label'?: string
}

export function Button({
  children,
  variant = 'secondary',
  size = 'sm',
  icon: Icon,
  rightIcon: RightIcon,
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  title,
  'aria-label': ariaLabel,
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors duration-150 rounded-[var(--radius-control)] cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none'

  const sizeStyles =
    {
      xs: 'text-[12px] px-3 py-1.5 min-h-[34px] gap-1.5',
      sm: 'text-[13px] px-3.5 py-2 min-h-[38px] gap-2',
      md: 'text-[14px] px-4 py-2.5 min-h-[42px] gap-2',
      lg: 'text-[14px] px-5 py-3 min-h-[44px] gap-2.5',
    }[size] || 'text-[13px] px-3.5 py-2 min-h-[38px] gap-2'

  const primaryClass =
    'bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold shadow-xs'

  const variantMap: Record<string, string> = {
    primary: primaryClass,
    brand: primaryClass,
    lime: primaryClass,
    secondary:
      'bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text)] border border-[var(--border)] font-medium',
    outline:
      'bg-transparent hover:bg-[var(--primary-soft)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--primary)]',
    ghost: 'bg-transparent hover:bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--text)]',
    subtle: 'bg-transparent hover:bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--text)]',
    danger:
      'bg-[var(--danger)] hover:bg-red-700 text-white font-semibold shadow-xs',
  }

  const variantStyles = variantMap[variant] || variantMap.secondary

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
      {RightIcon && <RightIcon className="w-4 h-4 shrink-0" />}
    </button>
  )
}

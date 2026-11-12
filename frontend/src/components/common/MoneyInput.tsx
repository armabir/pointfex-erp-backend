import { formatBDT } from '../../utils/money'

export interface MoneyInputProps {
  id?: string
  label?: string
  value: number | string
  onChangeDigits: (numericValue: number) => void
  min?: number
  max?: number
  required?: boolean
  hint?: string
  error?: string
  placeholder?: string
}

export function MoneyInput({
  id,
  label,
  value,
  onChangeDigits,
  min,
  max,
  required = false,
  hint,
  error,
  placeholder = '0',
}: MoneyInputProps) {
  const digitsOnly = String(value ?? '').replace(/[^\d]/g, '')
  const numericValue = digitsOnly ? Number(digitsOnly) : 0

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-[var(--text)]">
          {label}
          {required && <span className="text-[var(--danger)] ml-1">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <span
          aria-hidden="true"
          className="absolute left-3.5 text-[14px] font-semibold text-[var(--muted)] select-none pointer-events-none"
        >
          ৳
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          required={required}
          value={digitsOnly}
          placeholder={placeholder}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^\d]/g, '')
            let next = cleaned ? Number(cleaned) : 0
            if (max !== undefined && next > max) next = max
            onChangeDigits(next)
          }}
          className={`w-full pl-8 pr-3.5 py-2 min-h-[40px] rounded-[var(--radius-control)] bg-[var(--surface)] border text-[14px] font-medium text-[var(--text)] text-right tabular-nums placeholder:text-[var(--muted)] transition-colors ${
            error ? 'border-[var(--danger)]' : 'border-[var(--border)]'
          }`}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className={error ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}>
          {error || hint || (min !== undefined ? `Minimum ${formatBDT(min)}` : 'Amount in BDT (৳)')}
        </span>
        <span className="font-medium text-[var(--text)] tabular-nums">
          {formatBDT(numericValue)}
        </span>
      </div>
    </div>
  )
}


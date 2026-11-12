import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

interface FieldShellProps {
  id?: string
  label?: string
  hint?: string
  error?: string
  required?: boolean
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldShellProps & { children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-[var(--text)]">
          {label}
          {required && <span className="text-[var(--danger)] ml-1">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[12px] text-[var(--danger)]">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL_CLASS =
  'w-full px-3.5 py-2 min-h-[40px] rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--border)] text-[14px] text-[var(--text)] placeholder:text-[var(--muted)] disabled:opacity-60 transition-colors'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldShellProps {
  prefixText?: string
}

export function Input({
  id,
  label,
  hint,
  error,
  required,
  prefixText,
  className = '',
  ...rest
}: InputProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <div className="relative flex items-center">
        {prefixText && (
          <span className="absolute left-3.5 text-[14px] font-medium text-[var(--muted)] select-none pointer-events-none">
            {prefixText}
          </span>
        )}
        <input
          id={id}
          required={required}
          className={`${CONTROL_CLASS} ${prefixText ? 'pl-8' : ''} ${
            error ? 'border-[var(--danger)]' : ''
          } ${className}`}
          {...rest}
        />
      </div>
    </FieldShell>
  )
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldShellProps {
  options?: SelectOption[]
}

export function Select({
  id,
  label,
  hint,
  error,
  required,
  options,
  children,
  className = '',
  ...rest
}: SelectProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <select
        id={id}
        required={required}
        className={`${CONTROL_CLASS} ${error ? 'border-[var(--danger)]' : ''} ${className}`}
        {...rest}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    </FieldShell>
  )
}

export type DatePickerProps = Omit<InputProps, 'type' | 'prefixText'>

export function DatePicker(props: DatePickerProps) {
  return <Input type="date" {...props} />
}


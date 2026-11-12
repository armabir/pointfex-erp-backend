const BDT_PARTS_FORMATTER = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function formatSouthAsianInteger(intDigits: string): string {
  const clean = intDigits.replace(/\D/g, '') || '0'
  if (clean.length <= 3) return clean
  const lastThree = clean.slice(-3)
  const rest = clean.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return `${rest},${lastThree}`
}

/**
 * Formats an amount in Bangladeshi Taka (৳) using South Asian lakh/crore grouping
 * (e.g. 500000 -> "৳5,00,000", 12500000 -> "৳1,25,00,000").
 */
export function formatBDT(
  amount: number | string | null | undefined,
  showDecimals = false,
): string {
  const raw = typeof amount === 'string' ? Number(amount) : Number(amount ?? 0)
  const numeric = Number.isFinite(raw) ? raw : 0
  const isNegative = numeric < 0
  const absVal = Math.abs(numeric)
  const rounded = showDecimals ? Math.round(absVal * 100) / 100 : Math.round(absVal)

  const parts = BDT_PARTS_FORMATTER.formatToParts(rounded)
  const currencySymbol = parts.find((p) => p.type === 'currency')?.value || '৳'
  const rawInt = parts
    .filter((p) => p.type === 'integer')
    .map((p) => p.value)
    .join('')
  const fraction = parts.find((p) => p.type === 'fraction')?.value

  const groupedInt = formatSouthAsianInteger(rawInt)
  const formatted = showDecimals ? `${groupedInt}.${(fraction || '').padEnd(2, '0')}` : groupedInt
  return `${isNegative ? '-' : ''}${currencySymbol === 'BDT' ? '৳' : currencySymbol}${formatted}`
}

/**
 * Compact South Asian Taka formatting for dashboard KPIs and summaries
 * (e.g. 500000 -> "৳5 lakh", 12000000 -> "৳1.2 crore").
 */
export function formatBDTCompact(amount: number | string | null | undefined): string {
  const raw = typeof amount === 'string' ? Number(amount) : Number(amount ?? 0)
  const numeric = Number.isFinite(raw) ? raw : 0
  const sign = numeric < 0 ? '-' : ''
  const abs = Math.abs(numeric)

  if (abs >= 1_00_00_000) {
    const crore = Number((abs / 1_00_00_000).toFixed(2))
    return `${sign}৳${crore} crore`
  }
  if (abs >= 1_00_000) {
    const lakh = Number((abs / 1_00_000).toFixed(2))
    return `${sign}৳${lakh} lakh`
  }
  return formatBDT(numeric)
}

export function moneyToneClass(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0)
  if (!Number.isFinite(n) || n === 0) return 'text-[var(--text)]'
  return n > 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
}

import { useState } from 'react'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps {
  src?: string | null
  name?: string | null
  initials?: string | null
  alt?: string
  title?: string
  size?: AvatarSize
  className?: string
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-xl',
}

/**
 * Extracts clean corporate initials from an employee's name (e.g., "Fahim" -> "F", "Noor" -> "N",
 * "Nusrat Jahan" -> "NJ") with fallback to stored initials or a neutral "PF" badge.
 */
// oxlint-disable-next-line react/only-export-components
export function extractAvatarInitials(
  name?: string | null,
  providedInitials?: string | null,
): string {
  const cleanedName = name?.trim()
  if (cleanedName) {
    const parts = cleanedName.split(/\s+/).filter(Boolean)
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase()
    }
    if (parts.length > 1) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
    }
  }

  const cleanedInitials = providedInitials?.trim()
  if (cleanedInitials) {
    return cleanedInitials.slice(0, 2).toUpperCase()
  }

  return 'PF'
}

export function Avatar({
  src,
  name,
  initials,
  alt,
  title,
  size = 'md',
  className = '',
}: AvatarProps) {
  const normalizedSrc = typeof src === 'string' ? src.trim() : ''
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const hasError = Boolean(normalizedSrc) && failedSrc === normalizedSrc

  const sizeClass = SIZE_CLASSES[size]
  const displayInitials = extractAvatarInitials(name, initials)
  const label = alt ?? name ?? 'Employee'

  if (!normalizedSrc || hasError) {
    return (
      <div
        role="img"
        aria-label={label}
        title={title ?? label}
        className={`rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}
      >
        {displayInitials}
      </div>
    )
  }

  return (
    <img
      src={normalizedSrc}
      alt={label}
      title={title ?? label}
      onError={() => setFailedSrc(normalizedSrc)}
      className={`rounded-full object-cover shrink-0 ${sizeClass} ${className}`}
    />
  )
}

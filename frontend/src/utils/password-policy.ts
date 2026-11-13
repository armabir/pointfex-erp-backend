export const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '12345678',
  '123456789',
  'admin123',
  'admin1234',
  'welcome123',
  'pointfex123',
  'qwerty123',
  'letmein123',
  'iloveyou123',
  'changeme123',
  'bangladesh123',
  'dhaka1234',
])

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
  score: number // 0 to 4
  rules: {
    minLength: boolean
    hasUpper: boolean
    hasLower: boolean
    hasNumber: boolean
    hasSymbol: boolean
    notCommon: boolean
    noNameOrEmail: boolean
  }
}

export function validatePasswordStrength(
  password: string,
  user?: { name?: string; email?: string },
): PasswordValidationResult {
  const minLength = 8
  const errors: string[] = []

  const hasLength = Boolean(password && password.length >= minLength && password.length <= 128)
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  if (!hasLength) errors.push(`At least ${minLength} characters (up to 128)`)
  if (!hasUpper) errors.push('At least one uppercase letter')
  if (!hasLower) errors.push('At least one lowercase letter')
  if (!hasNumber) errors.push('At least one number')
  if (!hasSymbol) errors.push('At least one symbol or special character')

  const lowerPwd = (password || '').toLowerCase()
  const strippedLower = lowerPwd.replace(/[^a-z0-9]/g, '')
  const notCommon = !COMMON_PASSWORDS.has(lowerPwd) && !COMMON_PASSWORDS.has(strippedLower)
  if (!notCommon) errors.push('Not a common or easily guessed password')

  let noNameOrEmail = true
  if (user?.email) {
    const emailPrefix = user.email.split('@')[0]?.toLowerCase()
    if (emailPrefix && emailPrefix.length >= 3 && lowerPwd.includes(emailPrefix)) {
      noNameOrEmail = false
      errors.push('Must not contain your email address')
    }
  }

  if (noNameOrEmail && user?.name) {
    const parts = user.name.toLowerCase().split(/\s+/).filter((p) => p.length >= 3)
    for (const part of parts) {
      if (lowerPwd.includes(part)) {
        noNameOrEmail = false
        errors.push('Must not contain your name')
        break
      }
    }
  }

  let score = 0
  if (hasLength) score += 1
  if (hasUpper && hasLower) score += 1
  if (hasNumber && hasSymbol) score += 1
  if (notCommon && noNameOrEmail && password.length >= 10) score += 1
  if (errors.length > 0) score = Math.min(score, 3)

  return {
    valid: errors.length === 0,
    errors,
    score,
    rules: {
      minLength: hasLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSymbol,
      notCommon,
      noNameOrEmail,
    },
  }
}


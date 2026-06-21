import i18n from '../../shared/i18n/i18n'

export type PasswordStrength = 'weak' | 'medium' | 'strong'

export type PasswordStrengthInfo = {
  level: PasswordStrength
  label: string
  color: string
}

/**
 * Simple length/charset-based strength rule.
 * - weak: < 8 chars
 * - strong: >= 10 chars and at least 3 of {lower, upper, digit, symbol}
 * - medium: everything in between
 */
export function getPasswordStrength(password: string): PasswordStrengthInfo {
  const length = password.length
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length

  let level: PasswordStrength = 'weak'
  if (length >= 10 && classes >= 3) level = 'strong'
  else if (length >= 8 && classes >= 2) level = 'medium'

  const meta: Record<PasswordStrength, PasswordStrengthInfo> = {
    weak: { level: 'weak', label: i18n.t('passwordStrength.weak'), color: 'var(--color-due)' },
    medium: { level: 'medium', label: i18n.t('passwordStrength.medium'), color: 'var(--color-overdue)' },
    strong: { level: 'strong', label: i18n.t('passwordStrength.strong'), color: '#46D38A' },
  }
  return meta[level]
}

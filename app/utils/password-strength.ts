import { passwordRules } from '#shared/validation/password'

const MISSING_HINT: Record<string, string> = {
  length: 'Нужно минимум 10 символов',
  letter: 'Добавьте букву',
  digit: 'Добавьте цифру',
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4, valid: boolean, hint: string }

export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, valid: false, hint: 'Минимум 10 символов, буква и цифра' }
  const missing = passwordRules.find(r => !r.test(pw))
  if (missing) return { score: 1, valid: false, hint: MISSING_HINT[missing.id] ?? missing.label }
  const mixedCase = pw.length >= 12 && /\p{Lu}/u.test(pw) && /\p{Ll}/u.test(pw)
  const special = /[^\p{L}\d]/u.test(pw)
  const score = (2 + Number(mixedCase) + Number(special)) as 2 | 3 | 4
  return { score, valid: true, hint: score === 4 ? 'Надёжный пароль' : 'Подойдёт. Длиннее, с заглавными и символами – надёжнее' }
}

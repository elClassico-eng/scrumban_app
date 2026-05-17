import { z } from 'zod'

export type PasswordRule = {
  id: string
  label: string
  test: (password: string) => boolean
}

export const passwordRules: readonly PasswordRule[] = [
  { id: 'length', label: 'Минимум 10 символов', test: p => p.length >= 10 },
  { id: 'letter', label: 'Содержит букву', test: p => /[\p{L}]/u.test(p) },
  { id: 'digit', label: 'Содержит цифру', test: p => /\d/.test(p) },
] as const

export const passwordSchema = z.string()
  .min(10, 'Минимум 10 символов')
  .max(128, 'Слишком длинный пароль')
  .refine(p => /[\p{L}]/u.test(p), 'Должна быть хотя бы одна буква')
  .refine(p => /\d/.test(p), 'Должна быть хотя бы одна цифра')

export function passwordStrengthScore(password: string): number {
  return passwordRules.reduce((acc, rule) => acc + (rule.test(password) ? 1 : 0), 0)
}
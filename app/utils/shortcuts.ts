import type { ShortcutId, ShortcutPrefs } from '#shared/types/shortcuts'

export type ShortcutDef = { label: string, combo: string, where: string }

export const SHORTCUT_DEFS: Record<ShortcutId, ShortcutDef> = {
  go_inbox: { label: 'Входящие', combo: 'g-i', where: 'везде' },
  go_my_tasks: { label: 'Мои задачи', combo: 'g-m', where: 'везде' },
  go_overview: { label: 'Обзор воркспейса', combo: 'g-o', where: 'везде' },
  go_boards: { label: 'Доски', combo: 'g-b', where: 'везде' },
  new_task: { label: 'Новая задача', combo: 'c', where: 'везде: на текущей или последней доске' },
}

const MODIFIER_LABEL: Record<string, string> = { meta: '⌘', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' }

export type ComboView = { keys: string[], chained: boolean }

export function describeCombo(combo: string): ComboView {
  if (combo.includes('-')) return { keys: combo.split('-').map(k => k.toUpperCase()), chained: true }
  const parts = combo.split('_')
  return { keys: parts.map(p => MODIFIER_LABEL[p] ?? p.toUpperCase()), chained: false }
}

export function effectiveCombos(prefs: ShortcutPrefs): Record<ShortcutId, string> {
  return Object.fromEntries(
    (Object.keys(SHORTCUT_DEFS) as ShortcutId[]).map(id => [id, prefs[id] ?? SHORTCUT_DEFS[id].combo]),
  ) as Record<ShortcutId, string>
}

export function conflictOf(id: ShortcutId, combo: string, prefs: ShortcutPrefs): ShortcutId | null {
  const all = effectiveCombos(prefs)
  const leader = (c: string) => (c.includes('-') ? c.split('-')[0] : null)
  for (const other of Object.keys(all) as ShortcutId[]) {
    if (other === id) continue
    const c = all[other]
    if (c === combo || leader(c) === combo || leader(combo) === c) return other
  }
  return null
}

const BROWSER_RESERVED = new Set(['meta_n', 'meta_t', 'meta_w', 'meta_q', 'meta_shift_n', 'meta_shift_t', 'ctrl_n', 'ctrl_t', 'ctrl_w', 'ctrl_shift_n', 'ctrl_shift_t', 'meta_k'])

export function isReserved(combo: string): boolean {
  return BROWSER_RESERVED.has(combo)
}

export type KeyStroke = { code: string, meta: boolean, ctrl: boolean, alt: boolean, shift: boolean }

export function keyOf(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]!.toLowerCase()
  const digit = /^Digit(\d)$/.exec(code)
  return digit ? digit[1]! : null
}

export function comboFromStrokes(strokes: KeyStroke[]): string | null {
  const [first, second] = strokes
  if (!first) return null
  const firstKey = keyOf(first.code)
  if (!firstKey) return null
  const mods = (['meta', 'ctrl', 'alt', 'shift'] as const).filter(m => first[m])
  if (mods.length) return [...mods, firstKey].join('_')
  if (!second) return firstKey
  const secondKey = keyOf(second.code)
  const plain = !second.meta && !second.ctrl && !second.alt && !second.shift
  return secondKey && plain ? `${firstKey}-${secondKey}` : null
}

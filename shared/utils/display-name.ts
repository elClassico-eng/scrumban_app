// Render rule: «Фамилия Имя» when both present, otherwise whatever single
// part is set, fallback to email. Used everywhere members surface — task
// cards, focus modal, history, members page, app header. Single source of
// truth so the day we add «Отчество» or switch order, we touch one file.

export interface DisplayNameSource {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
}

export function displayName(user: DisplayNameSource | null | undefined): string {
  if (!user) return '—'
  const first = user.firstName?.trim()
  const last = user.lastName?.trim()
  if (last && first) return `${last} ${first}`
  if (last) return last
  if (first) return first
  return user.email ?? '—'
}

// Two-letter initials for avatar placeholders: ФИ → first letter of each
// part. Falls back to email's leading letter when no name is set.
export function initials(user: DisplayNameSource | null | undefined): string {
  if (!user) return '?'
  const first = user.firstName?.trim()
  const last = user.lastName?.trim()
  if (last && first) return `${last[0]}${first[0]}`.toUpperCase()
  if (last) return last.slice(0, 2).toUpperCase()
  if (first) return first.slice(0, 2).toUpperCase()
  return (user.email ?? '?').slice(0, 1).toUpperCase()
}

// All server errors are normalised by server/utils/errors.ts to put the
// human-readable Russian message in `data.message`. This helper centralises
// extraction so components don't reach into FetchError internals.

interface ApiErrorShape {
  statusCode?: number
  statusMessage?: string
  data?: {
    message?: string
    issues?: Array<{ message?: string; path?: Array<string | number> }>
  }
}

export function getErrorMessage(err: unknown, fallback = 'Что-то пошло не так'): string {
  if (!err || typeof err !== 'object') return fallback
  const e = err as ApiErrorShape
  return e.data?.message ?? e.statusMessage ?? fallback
}

export function getErrorStatus(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null
  return (err as ApiErrorShape).statusCode ?? null
}

export function getFieldIssues(err: unknown): Array<{ path: string; message: string }> {
  if (!err || typeof err !== 'object') return []
  const issues = (err as ApiErrorShape).data?.issues ?? []
  return issues.map(i => ({
    path: (i.path ?? []).join('.'),
    message: i.message ?? '',
  }))
}
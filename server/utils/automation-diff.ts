import type { AutomationSubjectType } from '#shared/types/automation'

export type Subject = {
  subjectType: AutomationSubjectType
  subjectId: string
  payload: Record<string, unknown>
}

type OpenFiring = { id: string; subjectType: string; subjectId: string }

const key = (s: { subjectType: string; subjectId: string }) => `${s.subjectType}:${s.subjectId}`

export function diffFirings(
  open: OpenFiring[],
  current: Subject[],
): { toOpen: Subject[]; toResolve: string[] } {
  const openKeys = new Set(open.map(key))
  const currentKeys = new Set(current.map(key))
  return {
    toOpen: current.filter((s) => !openKeys.has(key(s))),
    toResolve: open.filter((f) => !currentKeys.has(key(f))).map((f) => f.id),
  }
}

import type { Task } from '#shared/types/task'

export type OptionalListColumn = 'sprint' | 'checklist' | 'time'

const WIDTH: Record<OptionalListColumn, string> = { sprint: '110px', checklist: '124px', time: '86px' }
const ORDER: OptionalListColumn[] = ['sprint', 'checklist', 'time']

export function visibleColumns(tasks: Task[], sprintTaskIds: Set<string>): Set<OptionalListColumn> {
  const out = new Set<OptionalListColumn>()
  for (const t of tasks) {
    if (sprintTaskIds.has(t.id)) out.add('sprint')
    if (t.checklistTotal > 0) out.add('checklist')
    if (t.timeSpentSeconds > 0) out.add('time')
  }
  return out
}

export function listColumnsTemplate(visible: Set<OptionalListColumn>): string {
  return ['minmax(0,1fr)', '96px', '132px', '138px', '52px', ...ORDER.filter(c => visible.has(c)).map(c => WIDTH[c])].join(' ')
}

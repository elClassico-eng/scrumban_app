import type { SprintNetworkData } from '../services/network-forecast.service'

const DAY_MS = 86_400_000

const TASKS: { id: string; title: string; storyPoints: number | null; deps: string[] }[] = [
  { id: '00000000-0000-4000-8000-000000000001', title: 'Спроектировать API интеграции', storyPoints: 3, deps: [] },
  { id: '00000000-0000-4000-8000-000000000002', title: 'Реализовать обмен с 1С', storyPoints: 8, deps: ['00000000-0000-4000-8000-000000000001'] },
  { id: '00000000-0000-4000-8000-000000000003', title: 'Экран настроек интеграции', storyPoints: 5, deps: ['00000000-0000-4000-8000-000000000001'] },
  { id: '00000000-0000-4000-8000-000000000004', title: 'E2E-тесты обмена', storyPoints: 3, deps: ['00000000-0000-4000-8000-000000000002'] },
  { id: '00000000-0000-4000-8000-000000000005', title: 'Ревью безопасности', storyPoints: 2, deps: ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'] },
  { id: '00000000-0000-4000-8000-000000000006', title: 'Обновить документацию', storyPoints: 2, deps: [] },
]

const HISTORY: { storyPoints: number | null; cycleDays: number }[] = [
  { storyPoints: 2, cycleDays: 1.4 },
  { storyPoints: 2, cycleDays: 2.1 },
  { storyPoints: 3, cycleDays: 2.6 },
  { storyPoints: 3, cycleDays: 3.4 },
  { storyPoints: 5, cycleDays: 3.9 },
  { storyPoints: 5, cycleDays: 5.2 },
  { storyPoints: 8, cycleDays: 5.8 },
  { storyPoints: 8, cycleDays: 7.5 },
]

export const SANDBOX_SPRINT_ID = 'sandbox-demo-sprint'

export function buildSandboxData(): SprintNetworkData {
  const now = Date.now()
  const memberRows = TASKS.map(t => ({
    taskId: t.id,
    title: t.title,
    storyPoints: t.storyPoints,
    estimateDays: null,
    closedAt: null,
  }))
  return {
    sprint: {
      id: SANDBOX_SPRINT_ID,
      workspaceId: SANDBOX_SPRINT_ID,
      boardId: SANDBOX_SPRINT_ID,
      name: 'Демо-спринт: интеграция с 1С',
      goal: 'Показать симулятор на учебных данных',
      state: 'active',
      plannedStartAt: new Date(now - 2 * DAY_MS),
      plannedEndAt: new Date(now + 8 * DAY_MS),
      startedAt: new Date(now - 2 * DAY_MS),
      endedAt: null,
      capacity: null,
      createdAt: new Date(now - 3 * DAY_MS),
      updatedAt: new Date(now - 2 * DAY_MS),
    },
    memberRows,
    history: HISTORY,
    remaining: memberRows,
    edges: TASKS.flatMap(t =>
      t.deps.map(dep => ({ blockerTaskId: dep, blockedTaskId: t.id })),
    ),
  }
}

import { describe, expect, it } from 'vitest'
import type { BoardPulse } from '#shared/types/pulse'
import type { Task } from '#shared/types/task'
import { endOfDayIso } from './calendar'
import { nextActions, type NextActionsInput } from './next-actions'

const NOW = new Date('2031-03-12T09:00:00')

function day(offset: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() + offset)
  return endOfDayIso(d)
}

function task(p: Partial<Task>): Task {
  return { id: 't', boardId: 'b', title: 'Задача', dueDate: null, closedAt: null, serviceClass: 'standard', ...p } as Task
}

function pulse(p: Partial<BoardPulse> = {}): BoardPulse {
  return {
    board: { id: 'b', name: 'Поток', sleDays: 10, replenishment: { lastAt: null, periodDays: 7 } },
    wip: [],
    aging: { count: 0, p85Days: null },
    blockers: { count: 0, longestDays: null },
    firings: { count: 0, latestTrigger: null },
    myTasks: { open: 0, inProgress: 0 },
    dueSoon: null,
    throughput7: [],
    sprint: null,
    ...p,
  }
}

function input(p: Partial<NextActionsInput> = {}): NextActionsInput {
  return {
    now: NOW,
    workspaceId: 'w',
    role: 'member',
    pulse: pulse(),
    inboxUnread: 0,
    assigned: [],
    myTasks: [],
    ...p,
  }
}

const ids = (i: NextActionsInput) => nextActions(i).map(a => a.id)

describe('nextActions', () => {
  it('suggests nothing when all is calm, so the island can say so', () => {
    expect(nextActions(input())).toEqual([])
  })

  it('puts my most overdue task first and explains how late it is', () => {
    const actions = nextActions(input({
      myTasks: [
        { task: task({ id: 'a', title: 'Старая', dueDate: day(-5) }), columnRole: 'in_progress' },
        { task: task({ id: 'b', title: 'Вчерашняя', dueDate: day(-1) }), columnRole: 'backlog' },
      ],
      inboxUnread: 3,
    }))
    expect(actions[0]).toMatchObject({ id: 'overdue:a', reason: 'срок прошёл 5 дн назад' })
    expect(actions.map(a => a.id)).toContain('inbox')
  })

  it('shows flow-management actions only to scrum masters and above', () => {
    const flow = pulse({
      wip: [{ columnId: 'c', name: 'Ревью', count: 5, limit: 3 }],
      board: { id: 'b', name: 'Поток', sleDays: 10, replenishment: { lastAt: day(-10), periodDays: 7 } },
      sprint: { id: 's', name: 'Спринт 7', pct: 80, daysLeft: 1, probability: 40 },
    })
    expect(ids(input({ role: 'member', pulse: flow }))).toEqual([])
    expect(ids(input({ role: 'scrum_master', pulse: flow }))).toEqual(['wip:c', 'replenish', 'sprint-end'])
  })

  it('never offers work actions to a viewer', () => {
    const actions = nextActions(input({
      role: 'viewer',
      inboxUnread: 2,
      myTasks: [{ task: task({ dueDate: day(-1) }), columnRole: 'in_progress' }],
    }))
    expect(actions.map(a => a.id)).toEqual(['inbox'])
  })

  it('offers to continue the task in progress when nothing is burning', () => {
    const actions = nextActions(input({
      myTasks: [
        { task: task({ id: 'a', title: 'В бэклоге' }), columnRole: 'backlog' },
        { task: task({ id: 'b', title: 'В работе' }), columnRole: 'in_progress' },
      ],
    }))
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ id: 'continue:b', title: 'Продолжить: «В работе»' })
  })

  it('keeps at most three actions', () => {
    const actions = nextActions(input({
      role: 'owner',
      inboxUnread: 1,
      assigned: [{ id: 'c', taskId: 't2', boardId: 'b', taskTitle: 'X', authorName: 'Игорь' }],
      myTasks: [{ task: task({ dueDate: day(-2) }), columnRole: 'in_progress' }],
      pulse: pulse({ wip: [{ columnId: 'c', name: 'Ревью', count: 5, limit: 3 }], blockers: { count: 2, longestDays: 4 } }),
    }))
    expect(actions).toHaveLength(3)
  })
})

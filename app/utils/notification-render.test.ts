import { describe, expect, it } from 'vitest'
import { renderNotification } from './notification-render'

const base = { id: 'n', workspaceId: 'w', userId: 'u', readAt: null, createdAt: '2026-10-10T00:00:00Z' }

describe('renderNotification', () => {
  it('renders task_aging with numbers and task target', () => {
    const r = renderNotification({
      ...base,
      type: 'automation',
      payload: {
        trigger: 'task_aging',
        boardId: 'b',
        taskId: 't',
        taskTitle: 'SLE-дашборд',
        columnName: 'Review',
        ageDays: 9,
        sleDays: 7,
        pct: 128,
      },
    })
    expect(r.title).toBe('Задача застряла')
    expect(r.why).toContain('9 дн')
    expect(r.why).toContain('128%')
    expect(r.cta).toBe('Открыть задачу')
    expect(r.target).toEqual({ path: '/workspaces/w/boards/b', query: { task: 't' } })
  })

  it('renders sprint_forecast with sprints target', () => {
    const r = renderNotification({
      ...base,
      type: 'automation',
      payload: { trigger: 'sprint_forecast', boardId: 'b', sprintName: 'Спринт 7', probability: 42, tasksRemaining: 6, daysLeft: 3 },
    })
    expect(r.title).toBe('Прогноз спринта упал')
    expect(r.why).toContain('42%')
    expect(r.target).toBe('/workspaces/w/boards/b/sprints')
  })

  it('renders legacy sle_breach', () => {
    const r = renderNotification({
      ...base,
      type: 'sle_breach',
      payload: { taskId: 't', boardId: 'b', taskTitle: 'X', agePct: 90 },
    })
    expect(r.title).toBe('Задача застряла дольше SLE')
    expect(r.target).not.toBeNull()
  })

  it('renders mention with actor', () => {
    const r = renderNotification({
      ...base,
      type: 'mention',
      payload: { taskId: 't', boardId: 'b', taskTitle: 'X', actorName: 'Аня' },
    })
    expect(r.why).toContain('Аня')
    expect(r.why).toContain('X')
  })

  it('returns null target when payload lacks ids', () => {
    const r = renderNotification({ ...base, type: 'automation', payload: { trigger: 'wip_exceeded' } })
    expect(r.target).toBeNull()
  })
})

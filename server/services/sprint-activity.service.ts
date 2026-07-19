import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { SprintActivityItem, SprintActivityKind } from '../../shared/types/sprint-activity'
import {
  sprintEvents,
  sprints,
  taskEvents,
  tasks,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { requireMinRole } from '../utils/rbac'

const LIMIT = 50
const LOOKBACK_MS = 30 * 86_400_000

const TASK_KIND: Partial<Record<string, SprintActivityKind>> = {
  task_added_to_sprint: 'task_added',
  task_removed_from_sprint: 'task_removed',
  task_blocked: 'task_blocked',
  task_unblocked: 'task_unblocked',
}

export async function computeSprintActivity(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<SprintActivityItem[]> {
  requireMinRole(input.actorRole, 'viewer')

  const since = new Date(Date.now() - LOOKBACK_MS).toISOString()

  const data = await withTenant(input.workspaceId, async (tx) => {
    const boardSprints = await tx
      .select({ id: sprints.id, name: sprints.name })
      .from(sprints)
      .where(eq(sprints.boardId, input.boardId))
    const sprintIds = boardSprints.map(s => s.id)

    const sEvents = sprintIds.length > 0
      ? await tx
          .select()
          .from(sprintEvents)
          .where(and(
            inArray(sprintEvents.sprintId, sprintIds),
            sql`${sprintEvents.createdAt} >= ${since}::timestamptz`,
          ))
          .orderBy(desc(sprintEvents.createdAt))
          .limit(LIMIT)
      : []

    const tEvents = await tx
      .select({
        id: taskEvents.id,
        taskId: taskEvents.taskId,
        eventType: taskEvents.eventType,
        payload: taskEvents.payload,
        createdAt: taskEvents.createdAt,
        taskTitle: tasks.title,
      })
      .from(taskEvents)
      .innerJoin(tasks, eq(tasks.id, taskEvents.taskId))
      .where(and(
        eq(tasks.boardId, input.boardId),
        inArray(taskEvents.eventType, ['task_added_to_sprint', 'task_removed_from_sprint', 'task_blocked', 'task_unblocked']),
        sql`${taskEvents.createdAt} >= ${since}::timestamptz`,
      ))
      .orderBy(desc(taskEvents.createdAt))
      .limit(LIMIT)

    return { boardSprints, sEvents, tEvents }
  })

  const nameById = new Map(data.boardSprints.map(s => [s.id, s.name]))

  const fromSprint: SprintActivityItem[] = data.sEvents.map(e => ({
    id: e.id,
    kind: e.eventType as SprintActivityKind,
    atISO: e.createdAt.toISOString(),
    sprintId: e.sprintId,
    sprintName: nameById.get(e.sprintId) ?? null,
    taskId: null,
    taskTitle: null,
    reason: ((e.payload ?? {}) as { reason?: string }).reason ?? null,
  }))

  const fromTask: SprintActivityItem[] = data.tEvents.map((e) => {
    const payload = (e.payload ?? {}) as { sprintId?: string; reason?: string }
    const sprintId = payload.sprintId ?? null
    return {
      id: e.id,
      kind: TASK_KIND[e.eventType]!,
      atISO: e.createdAt.toISOString(),
      sprintId,
      sprintName: sprintId ? nameById.get(sprintId) ?? null : null,
      taskId: e.taskId,
      taskTitle: e.taskTitle,
      reason: payload.reason ?? null,
    }
  })

  return [...fromSprint, ...fromTask]
    .sort((a, b) => new Date(b.atISO).getTime() - new Date(a.atISO).getTime())
    .slice(0, LIMIT)
}

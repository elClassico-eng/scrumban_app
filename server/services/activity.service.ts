import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import {
  boards,
  taskEvents,
  tasks,
  users,
  type TaskEventType,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { requireMinRole } from '../utils/rbac'

const DEFAULT_LOOKBACK_DAYS = 14
const LIMIT = 500

export interface ActivityFilters {
  boardId?: string
  actorId?: string
  eventTypes?: TaskEventType[]
  from?: Date
  to?: Date
}

export interface ActivityEvent {
  id: string
  eventType: TaskEventType
  taskId: string
  taskTitle: string | null
  boardId: string | null
  boardName: string | null
  fromColumnId: string | null
  toColumnId: string | null
  actorId: string | null
  actorFirstName: string | null
  actorLastName: string | null
  actorEmail: string | null
  payload: unknown
  createdAt: Date
}

export async function listActivityForWorkspace(input: {
  workspaceId: string
  actorRole: WorkspaceMemberRole
  filters?: ActivityFilters
}): Promise<ActivityEvent[]> {
  requireMinRole(input.actorRole, 'viewer')

  const filters = input.filters ?? {}
  const to = filters.to ?? new Date()
  const from = filters.from ?? new Date(to.getTime() - DEFAULT_LOOKBACK_DAYS * 86_400_000)

  const conds = [
    eq(taskEvents.workspaceId, input.workspaceId),
    gte(taskEvents.createdAt, from),
    lte(taskEvents.createdAt, to),
  ]
  if (filters.boardId) conds.push(eq(tasks.boardId, filters.boardId))
  if (filters.actorId) conds.push(eq(taskEvents.actorId, filters.actorId))
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    conds.push(inArray(taskEvents.eventType, filters.eventTypes))
  }

  return withTenant(input.workspaceId, async (tx) => {
    const rows = await tx
      .select({
        id: taskEvents.id,
        eventType: taskEvents.eventType,
        taskId: taskEvents.taskId,
        taskTitle: tasks.title,
        boardId: tasks.boardId,
        boardName: boards.name,
        fromColumnId: taskEvents.fromColumnId,
        toColumnId: taskEvents.toColumnId,
        actorId: taskEvents.actorId,
        actorFirstName: users.firstName,
        actorLastName: users.lastName,
        actorEmail: users.email,
        payload: taskEvents.payload,
        createdAt: taskEvents.createdAt,
      })
      .from(taskEvents)
      .leftJoin(tasks, eq(tasks.id, taskEvents.taskId))
      .leftJoin(boards, eq(boards.id, tasks.boardId))
      .leftJoin(users, eq(users.id, taskEvents.actorId))
      .where(and(...conds))
      .orderBy(desc(taskEvents.createdAt))
      .limit(LIMIT)
    return rows
  })
}
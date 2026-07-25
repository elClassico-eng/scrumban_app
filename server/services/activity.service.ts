import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
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

export interface ActivityDayBucket {
  day: string
  eventType: TaskEventType
  count: number
}

// Aggregated server-side on purpose: listActivityForWorkspace caps at LIMIT
// rows ordered by recency, so counting a multi-week range from that list would
// silently under-report the oldest weeks.
export async function activityDailyCounts(input: {
  workspaceId: string
  actorRole: WorkspaceMemberRole
  from: Date
  to: Date
  timeZone: string
  boardId?: string
  actorId?: string
}): Promise<ActivityDayBucket[]> {
  requireMinRole(input.actorRole, 'viewer')

  const conds = [
    eq(taskEvents.workspaceId, input.workspaceId),
    gte(taskEvents.createdAt, input.from),
    lte(taskEvents.createdAt, input.to),
  ]
  if (input.boardId) conds.push(eq(tasks.boardId, input.boardId))
  if (input.actorId) conds.push(eq(taskEvents.actorId, input.actorId))

  // Grouped by output position: the timezone is a bound parameter, and repeating
  // the expression in GROUP BY binds it a second time, which Postgres then refuses
  // to match against the SELECT expression.
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select({
        day: sql<string>`((${taskEvents.createdAt} AT TIME ZONE ${input.timeZone})::date)::text`.as('day'),
        eventType: taskEvents.eventType,
        count: sql<number>`COUNT(*)::int`.as('count'),
      })
      .from(taskEvents)
      .leftJoin(tasks, eq(tasks.id, taskEvents.taskId))
      .where(and(...conds))
      .groupBy(sql`1`, taskEvents.eventType),
  )
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
import { and, eq, or, sql } from 'drizzle-orm'
import {
  boards,
  taskDependencies,
  tasks,
  type TaskDependency,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { requireMinRole } from '../utils/rbac'

export interface DependencyView {
  blockerTaskId: string
  blockedTaskId: string
  blockerTitle: string
  blockedTitle: string
  createdAt: Date
}

export async function addDependency(input: {
  workspaceId: string
  blockerTaskId: string
  blockedTaskId: string
  actorId: string
  actorRole: WorkspaceMemberRole
}): Promise<TaskDependency> {
  requireMinRole(input.actorRole, 'member')
  if (input.blockerTaskId === input.blockedTaskId) {
    throw new ValidationError('Задача не может блокировать саму себя')
  }

  return withTenant(input.workspaceId, async (tx) => {
    const taskRows = await tx
      .select({ id: tasks.id, boardId: tasks.boardId })
      .from(tasks)
      .where(or(eq(tasks.id, input.blockerTaskId), eq(tasks.id, input.blockedTaskId)))
    const blocker = taskRows.find(t => t.id === input.blockerTaskId)
    const blocked = taskRows.find(t => t.id === input.blockedTaskId)
    if (!blocker || !blocked) throw new NotFoundError('Одна из задач не найдена')
    if (blocker.boardId !== blocked.boardId) {
      throw new ValidationError('Зависимости можно ставить только в пределах одной доски')
    }

    // Lock the board row so concurrent dependency writes on this board
    // serialize — otherwise two parallel adds (A→B and B→A) each pass the
    // cycle check against pre-insert state and together close a loop.
    await tx.select({ id: boards.id }).from(boards).where(eq(boards.id, blocker.boardId)).for('update')

    // Cycle check: walking forward from blocked (following "what does
    // this task in turn block"), if we reach blocker the new edge would
    // close a loop. WITH RECURSIVE handles transitive paths in one round-trip.
    const cycleRows = await tx.execute<{ found: number }>(sql`
      WITH RECURSIVE downstream AS (
        SELECT blocked_task_id AS node
        FROM task_dependencies
        WHERE blocker_task_id = ${input.blockedTaskId}
        UNION
        SELECT td.blocked_task_id
        FROM task_dependencies td
        JOIN downstream d ON td.blocker_task_id = d.node
      )
      SELECT 1 AS found FROM downstream WHERE node = ${input.blockerTaskId} LIMIT 1
    `)
    if (cycleRows.length > 0) {
      throw new ValidationError('Цикл в графе зависимостей')
    }

    try {
      const [row] = await tx
        .insert(taskDependencies)
        .values({
          workspaceId: input.workspaceId,
          blockerTaskId: input.blockerTaskId,
          blockedTaskId: input.blockedTaskId,
          createdBy: input.actorId,
        })
        .returning()

      publishBoardEvent({
        type: 'task.updated',
        workspaceId: input.workspaceId,
        boardId: blocked.boardId,
        payload: { taskId: input.blockedTaskId, dependencyAdded: row },
      })
      return row!
    }
    catch (err) {
      // PK collision: edge already exists.
      if (isPgUniqueViolation(err)) {
        throw new ConflictError('Такая зависимость уже существует')
      }
      throw err
    }
  })
}

export async function removeDependency(input: {
  workspaceId: string
  blockerTaskId: string
  blockedTaskId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')

  const blockedBoardId = await withTenant(input.workspaceId, async (tx) => {
    const [target] = await tx
      .select({ boardId: tasks.boardId })
      .from(tasks)
      .where(eq(tasks.id, input.blockedTaskId))

    const result = await tx
      .delete(taskDependencies)
      .where(
        and(
          eq(taskDependencies.blockerTaskId, input.blockerTaskId),
          eq(taskDependencies.blockedTaskId, input.blockedTaskId),
        ),
      )
    if ((result.count ?? 0) === 0) {
      throw new NotFoundError('Зависимость не найдена')
    }
    return target?.boardId ?? null
  })

  if (blockedBoardId) {
    publishBoardEvent({
      type: 'task.updated',
      workspaceId: input.workspaceId,
      boardId: blockedBoardId,
      payload: { taskId: input.blockedTaskId, dependencyRemoved: true },
    })
  }
}

export async function listBoardDependencyCounts(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<Array<{ taskId: string; blockerCount: number; blockedCount: number }>> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const rows = await tx.execute<{
      task_id: string
      blocker_count: number
      blocked_count: number
    }>(sql`
      SELECT t.id AS task_id,
             COALESCE(blocker_agg.cnt, 0)::int AS blocker_count,
             COALESCE(blocked_agg.cnt, 0)::int AS blocked_count
      FROM tasks t
      LEFT JOIN (
        SELECT blocked_task_id, COUNT(*) AS cnt
        FROM task_dependencies
        GROUP BY blocked_task_id
      ) blocker_agg ON blocker_agg.blocked_task_id = t.id
      LEFT JOIN (
        SELECT blocker_task_id, COUNT(*) AS cnt
        FROM task_dependencies
        GROUP BY blocker_task_id
      ) blocked_agg ON blocked_agg.blocker_task_id = t.id
      WHERE t.board_id = ${input.boardId}
        AND (COALESCE(blocker_agg.cnt, 0) > 0 OR COALESCE(blocked_agg.cnt, 0) > 0)
    `)
    return rows.map(r => ({
      taskId: r.task_id,
      blockerCount: Number(r.blocker_count),
      blockedCount: Number(r.blocked_count),
    }))
  })
}

// Returns the dependencies adjacent to a given task: who blocks it
// ("blockers") and which tasks it blocks ("blocks"). Joins with `tasks`
// once per side so the frontend can render titles without a follow-up call.
export async function listDependenciesForTask(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<{ blockers: DependencyView[]; blocks: DependencyView[] }> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) => {
    const blockerRows = await tx.execute<{
      blocker_task_id: string
      blocked_task_id: string
      blocker_title: string
      blocked_title: string
      created_at: Date
    }>(sql`
      SELECT td.blocker_task_id, td.blocked_task_id, td.created_at,
             blocker.title AS blocker_title, blocked.title AS blocked_title
      FROM task_dependencies td
      JOIN tasks blocker ON blocker.id = td.blocker_task_id
      JOIN tasks blocked ON blocked.id = td.blocked_task_id
      WHERE td.blocked_task_id = ${input.taskId}
      ORDER BY td.created_at
    `)

    const blockedRows = await tx.execute<{
      blocker_task_id: string
      blocked_task_id: string
      blocker_title: string
      blocked_title: string
      created_at: Date
    }>(sql`
      SELECT td.blocker_task_id, td.blocked_task_id, td.created_at,
             blocker.title AS blocker_title, blocked.title AS blocked_title
      FROM task_dependencies td
      JOIN tasks blocker ON blocker.id = td.blocker_task_id
      JOIN tasks blocked ON blocked.id = td.blocked_task_id
      WHERE td.blocker_task_id = ${input.taskId}
      ORDER BY td.created_at
    `)

    const mapRow = (r: {
      blocker_task_id: string
      blocked_task_id: string
      blocker_title: string
      blocked_title: string
      created_at: Date
    }): DependencyView => ({
      blockerTaskId: r.blocker_task_id,
      blockedTaskId: r.blocked_task_id,
      blockerTitle: r.blocker_title,
      blockedTitle: r.blocked_title,
      createdAt: r.created_at,
    })

    return {
      blockers: blockerRows.map(mapRow),
      blocks: blockedRows.map(mapRow),
    }
  })
}

const PG_UNIQUE_VIOLATION = '23505'
function isPgUniqueViolation(err: unknown): boolean {
  const candidate =
    typeof err === 'object' && err !== null && 'cause' in err
      ? (err as { cause?: unknown }).cause
      : err
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'code' in candidate &&
    (candidate as { code?: string }).code === PG_UNIQUE_VIOLATION
  )
}
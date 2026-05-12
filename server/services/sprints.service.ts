// SprintsService: lifecycle of sprints + the M:N association with tasks.
//
// State machine:
//   planned → active → closed
//   planned → closed   (cancelling a never-started sprint)
//
// Authorisation matrix (enforced here):
//   list / get                     → viewer+
//   create / update / start / close → scrum_master+
//   delete                         → admin+
//   addTaskToSprint / remove       → member+ (developers attach their work)
//
// Once a sprint enters `closed`, its task membership is frozen so velocity
// and burndown analytics for that sprint stay reproducible.
import { and, desc, eq, sql } from 'drizzle-orm'
import {
  sprintTasks,
  sprints,
  tasks,
  type Sprint,
  type SprintState,
  type WorkspaceMemberRole,
} from '../db/schema'
import { withTenant } from '../utils/db'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../utils/errors'
import { requireMinRole } from '../utils/rbac'

const PG_UNIQUE_VIOLATION = '23505'

export async function listSprints(input: {
  workspaceId: string
  boardId: string
  actorRole: WorkspaceMemberRole
}): Promise<Sprint[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select()
      .from(sprints)
      .where(eq(sprints.boardId, input.boardId))
      .orderBy(desc(sprints.createdAt)),
  )
}

export async function getSprint(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<Sprint> {
  requireMinRole(input.actorRole, 'viewer')
  const [row] = await withTenant(input.workspaceId, async (tx) =>
    tx.select().from(sprints).where(eq(sprints.id, input.sprintId)),
  )
  if (!row) throw new NotFoundError('Спринт не найден')
  return row
}

export async function createSprint(input: {
  workspaceId: string
  boardId: string
  name: string
  goal?: string
  plannedStartAt?: Date | null
  plannedEndAt?: Date | null
  actorRole: WorkspaceMemberRole
}): Promise<Sprint> {
  requireMinRole(input.actorRole, 'scrum_master')

  if (
    input.plannedStartAt &&
    input.plannedEndAt &&
    input.plannedStartAt >= input.plannedEndAt
  ) {
    throw new ValidationError('Дата окончания должна быть позже даты начала')
  }

  const [row] = await withTenant(input.workspaceId, async (tx) =>
    tx
      .insert(sprints)
      .values({
        workspaceId: input.workspaceId,
        boardId: input.boardId,
        name: input.name,
        goal: input.goal ?? '',
        plannedStartAt: input.plannedStartAt ?? null,
        plannedEndAt: input.plannedEndAt ?? null,
      })
      .returning(),
  )
  return row!
}

export async function updateSprint(input: {
  workspaceId: string
  sprintId: string
  patch: {
    name?: string
    goal?: string
    plannedStartAt?: Date | null
    plannedEndAt?: Date | null
  }
  actorRole: WorkspaceMemberRole
}): Promise<Sprint> {
  requireMinRole(input.actorRole, 'scrum_master')

  const set: Partial<typeof sprints.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }
  if (input.patch.name !== undefined) set.name = input.patch.name
  if (input.patch.goal !== undefined) set.goal = input.patch.goal
  if ('plannedStartAt' in input.patch) set.plannedStartAt = input.patch.plannedStartAt ?? null
  if ('plannedEndAt' in input.patch) set.plannedEndAt = input.patch.plannedEndAt ?? null

  const [row] = await withTenant(input.workspaceId, async (tx) =>
    tx.update(sprints).set(set).where(eq(sprints.id, input.sprintId)).returning(),
  )
  if (!row) throw new NotFoundError('Спринт не найден')

  // Belt-and-suspenders: also enforce the date order on update.
  if (row.plannedStartAt && row.plannedEndAt && row.plannedStartAt >= row.plannedEndAt) {
    throw new ValidationError('Дата окончания должна быть позже даты начала')
  }
  return row
}

export async function deleteSprint(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'admin')
  const result = await withTenant(input.workspaceId, async (tx) =>
    tx.delete(sprints).where(eq(sprints.id, input.sprintId)),
  )
  if ((result.count ?? 0) === 0) throw new NotFoundError('Спринт не найден')
}

export async function startSprint(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<Sprint> {
  requireMinRole(input.actorRole, 'scrum_master')

  return withTenant(input.workspaceId, async (tx) => {
    const [current] = await tx.select().from(sprints).where(eq(sprints.id, input.sprintId))
    if (!current) throw new NotFoundError('Спринт не найден')
    if (current.state !== 'planned') {
      const stateLabel = current.state === 'active' ? 'уже активен' : 'уже закрыт'
      throw new ValidationError(
        `Нельзя стартовать спринт — он ${stateLabel}. Стартовать можно только запланированный спринт`,
      )
    }

    try {
      const [row] = await tx
        .update(sprints)
        .set({ state: 'active', startedAt: new Date(), updatedAt: new Date() })
        .where(eq(sprints.id, input.sprintId))
        .returning()
      return row!
    } catch (err) {
      // Partial unique index "sprints_one_active_per_board_idx" enforces
      // at most one active sprint per board.
      if (isPgUniqueViolation(err)) {
        throw new ConflictError('На этой доске уже есть активный спринт')
      }
      throw err
    }
  })
}

export async function closeSprint(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<Sprint> {
  requireMinRole(input.actorRole, 'scrum_master')

  return withTenant(input.workspaceId, async (tx) => {
    const [current] = await tx.select().from(sprints).where(eq(sprints.id, input.sprintId))
    if (!current) throw new NotFoundError('Спринт не найден')
    if (current.state === 'closed') {
      throw new ValidationError('Спринт уже закрыт')
    }
    const [row] = await tx
      .update(sprints)
      .set({ state: 'closed', endedAt: new Date(), updatedAt: new Date() })
      .where(eq(sprints.id, input.sprintId))
      .returning()
    return row!
  })
}

// Add a task to a sprint. Refuses to mutate a closed sprint so analytics
// for that period stay reproducible. Both the task and sprint must
// belong to the same board (and same workspace, which RLS already
// guarantees).
export async function addTaskToSprint(input: {
  workspaceId: string
  sprintId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')

  await withTenant(input.workspaceId, async (tx) => {
    const [sprint] = await tx.select().from(sprints).where(eq(sprints.id, input.sprintId))
    if (!sprint) throw new NotFoundError('Спринт не найден')
    if (sprint.state === 'closed') {
      throw new ForbiddenError('Нельзя изменять закрытый спринт')
    }

    const [task] = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (!task) throw new NotFoundError('Задача не найдена')
    if (task.boardId !== sprint.boardId) {
      throw new ValidationError('Задача и спринт относятся к разным доскам')
    }

    try {
      await tx.insert(sprintTasks).values({
        sprintId: input.sprintId,
        taskId: input.taskId,
        workspaceId: input.workspaceId,
      })
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        throw new ConflictError('Задача уже добавлена в этот спринт')
      }
      throw err
    }
  })
}

export async function removeTaskFromSprint(input: {
  workspaceId: string
  sprintId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'member')

  await withTenant(input.workspaceId, async (tx) => {
    const [sprint] = await tx.select().from(sprints).where(eq(sprints.id, input.sprintId))
    if (!sprint) throw new NotFoundError('Спринт не найден')
    if (sprint.state === 'closed') {
      throw new ForbiddenError('Нельзя изменять закрытый спринт')
    }

    const result = await tx
      .delete(sprintTasks)
      .where(and(eq(sprintTasks.sprintId, input.sprintId), eq(sprintTasks.taskId, input.taskId)))

    if ((result.count ?? 0) === 0) {
      throw new NotFoundError('Задача не входит в этот спринт')
    }
  })
}

export async function listSprintTasks(input: {
  workspaceId: string
  sprintId: string
  actorRole: WorkspaceMemberRole
}): Promise<{ taskId: string; addedAt: Date }[]> {
  requireMinRole(input.actorRole, 'viewer')
  return withTenant(input.workspaceId, async (tx) =>
    tx
      .select({ taskId: sprintTasks.taskId, addedAt: sprintTasks.addedAt })
      .from(sprintTasks)
      .where(eq(sprintTasks.sprintId, input.sprintId)),
  )
}

function isPgUniqueViolation(err: unknown): boolean {
  const candidate =
    typeof err === 'object' && err !== null && 'cause' in err
      ? (err as { cause?: unknown }).cause
      : err
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'code' in candidate &&
    candidate.code === PG_UNIQUE_VIOLATION
  )
}

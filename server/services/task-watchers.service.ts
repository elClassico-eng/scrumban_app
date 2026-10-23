// Task watchers: who hears about a task's comments and column changes.
// Creator, assignees and commenters are added automatically; anyone in the
// workspace can watch or unwatch by hand.
import { and, eq } from 'drizzle-orm'
import { taskWatchers, tasks, type WorkspaceMemberRole } from '../db/schema'
import { withTenant, type DbTransaction } from '../utils/db'
import { NotFoundError } from '../utils/errors'
import { requireMinRole } from '../utils/rbac'
import { emitNotification } from './notifications.service'

export async function addWatcher(
  tx: DbTransaction,
  input: { workspaceId: string, taskId: string, userId: string },
): Promise<void> {
  await tx.insert(taskWatchers).values(input).onConflictDoNothing()
}

// `skip` holds people who already got a more specific notification for the
// same event (mention, reply, comment on their task) so nobody gets two.
export async function notifyWatchers(
  tx: DbTransaction,
  input: {
    workspaceId: string
    taskId: string
    actorId: string | null
    type: 'watched_comment' | 'watched_status'
    payload: Record<string, unknown>
    skip?: string[]
  },
): Promise<void> {
  const rows = await tx
    .select({ userId: taskWatchers.userId })
    .from(taskWatchers)
    .where(eq(taskWatchers.taskId, input.taskId))
  for (const { userId } of rows) {
    if (input.skip?.includes(userId)) continue
    await emitNotification({
      tx,
      workspaceId: input.workspaceId,
      recipientId: userId,
      actorId: input.actorId,
      type: input.type,
      payload: input.payload,
    })
  }
}

export async function listWatchers(input: {
  workspaceId: string
  taskId: string
  actorRole: WorkspaceMemberRole
}): Promise<string[]> {
  requireMinRole(input.actorRole, 'viewer')
  const rows = await withTenant(input.workspaceId, tx =>
    tx.select({ userId: taskWatchers.userId }).from(taskWatchers).where(eq(taskWatchers.taskId, input.taskId)),
  )
  return rows.map(r => r.userId)
}

export async function setWatching(input: {
  workspaceId: string
  taskId: string
  userId: string
  watching: boolean
  actorRole: WorkspaceMemberRole
}): Promise<void> {
  requireMinRole(input.actorRole, 'viewer')
  await withTenant(input.workspaceId, async (tx) => {
    const [task] = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, input.taskId))
    if (!task) throw new NotFoundError('Задача не найдена')
    if (input.watching) {
      await addWatcher(tx, { workspaceId: input.workspaceId, taskId: input.taskId, userId: input.userId })
    }
    else {
      await tx
        .delete(taskWatchers)
        .where(and(eq(taskWatchers.taskId, input.taskId), eq(taskWatchers.userId, input.userId)))
    }
  })
}

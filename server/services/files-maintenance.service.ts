import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm'
import { files, storageTrash, workspaces } from '../db/schema'
import { useDB, withTenant, withUser } from '../utils/db'
import { deleteObjects } from '../utils/storage'

const PENDING_TTL_MS = 3_600_000
const STAGED_TTL_MS = 86_400_000
const TRASH_DELAY_MS = 7 * 86_400_000
const PURGE_BATCH = 1000

function staleCondition(now: Date) {
  return or(
    and(eq(files.status, 'pending'), lt(files.createdAt, new Date(now.getTime() - PENDING_TTL_MS))),
    and(eq(files.status, 'staged'), lt(files.createdAt, new Date(now.getTime() - STAGED_TTL_MS))),
  )
}

export async function cleanupStaleUploads(now = new Date()): Promise<{ removed: number }> {
  let removed = 0
  const avatars = await useDB().select({ id: files.id, userId: files.userId }).from(files)
    .where(and(isNull(files.workspaceId), staleCondition(now)))
  for (const a of avatars) {
    await withUser(a.userId!, tx => tx.delete(files).where(eq(files.id, a.id)))
    removed++
  }
  const wsList = await useDB().select({ id: workspaces.id }).from(workspaces)
  for (const ws of wsList) {
    const rows = await withTenant(ws.id, tx =>
      tx.delete(files).where(and(eq(files.workspaceId, ws.id), staleCondition(now))).returning({ id: files.id }))
    removed += rows.length
  }
  return { removed }
}

export async function purgeTrash(now = new Date()): Promise<{ deleted: number, failed: number }> {
  const batch = await useDB().select({ key: storageTrash.key }).from(storageTrash)
    .where(lt(storageTrash.createdAt, new Date(now.getTime() - TRASH_DELAY_MS)))
    .limit(PURGE_BATCH)
  if (!batch.length) return { deleted: 0, failed: 0 }
  const { deleted, failed } = await deleteObjects(batch.map(b => b.key))
  if (deleted.length) await useDB().delete(storageTrash).where(inArray(storageTrash.key, deleted))
  return { deleted: deleted.length, failed: failed.length }
}

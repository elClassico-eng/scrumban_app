import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type { z } from 'zod'
import { boards, files, taskEvents, tasks, users, workspaces, type FileRow, type WorkspaceMemberRole } from '../db/schema'
import { useDB, withTenant, withUser, type DbTransaction } from '../utils/db'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { publishBoardEvent } from '../utils/events'
import { ATTACHMENT_WINDOW_SEC, dispositionFor, FILE_LIMITS, fileUrl, IMAGE_WINDOW_SEC, quotaBytes, sanitizeFileName, storageKeyFor, THUMB_MAX_BYTES, THUMB_TYPE, type FileKind } from '../utils/files'
import { roleAtLeast, requireMinRole } from '../utils/rbac'
import { headObjectSize, presignGet, presignPut, secondsLeftInWindow } from '../utils/storage'
import { getTask } from './tasks.service'
import { findWorkspaceForUser, listWorkspacesForUser } from './workspaces.service'
import type { FileView, StorageUsage, UploadTicket } from '#shared/types/files'
import type { StartAvatarUploadSchema, StartUploadSchema } from '#shared/validation/files'
import { displayName } from '#shared/utils/display-name'

const MB = 1_048_576

type Viewer = { userId: string, role: WorkspaceMemberRole | null }

function formatMb(bytes: number): string {
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} МБ`
}

function checkLimits(kind: FileKind, contentType: string, size: number, thumbSize?: number): void {
  const limit = FILE_LIMITS[kind]
  if (size > limit.maxBytes) throw new ValidationError(`Файл больше ${formatMb(limit.maxBytes)}`)
  if (limit.types && !limit.types.includes(contentType)) throw new ValidationError('Подходят только JPEG, PNG или WebP')
  if (thumbSize !== undefined && thumbSize > THUMB_MAX_BYTES) throw new ValidationError('Превью слишком большое')
}

export function toFileView(row: FileRow, viewer: Viewer, names: Map<string, string>): FileView {
  const isAdmin = !!viewer.role && roleAtLeast(viewer.role, 'admin')
  const canDelete = row.kind === 'user_avatar'
    ? row.userId === viewer.userId
    : row.kind === 'attachment'
      ? row.uploadedBy === viewer.userId || isAdmin
      : isAdmin
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    url: fileUrl(row),
    thumbUrl: row.thumbKey ? fileUrl(row, { thumb: true }) : null,
    downloadUrl: fileUrl(row, { download: true }),
    commentId: row.commentId,
    uploadedBy: row.uploadedBy ? { id: row.uploadedBy, name: names.get(row.uploadedBy) ?? '' } : null,
    createdAt: row.createdAt.toISOString(),
    canDelete,
  }
}

export async function uploaderNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (!unique.length) return new Map()
  const rows = await useDB().select().from(users).where(inArray(users.id, unique))
  return new Map(rows.map(u => [u.id, displayName(u)]))
}

async function usedBytes(tx: DbTransaction, workspaceId: string): Promise<number> {
  const [row] = await tx
    .select({ used: sql<string>`COALESCE(SUM(${files.sizeBytes} + ${files.thumbBytes}), 0)` })
    .from(files)
    .where(eq(files.workspaceId, workspaceId))
  return Number(row?.used ?? 0)
}

export async function storageUsage(workspaceId: string): Promise<StorageUsage> {
  const used = await withTenant(workspaceId, tx => usedBytes(tx, workspaceId))
  return { usedBytes: used, limitBytes: quotaBytes() }
}

async function ticketFor(row: FileRow, viewer: Viewer): Promise<UploadTicket> {
  return {
    file: toFileView(row, viewer, await uploaderNames([row.uploadedBy])),
    uploadUrl: await presignPut({ key: row.storageKey, contentType: row.contentType, size: row.sizeBytes }),
    thumbUploadUrl: row.thumbKey ? await presignPut({ key: row.thumbKey, contentType: THUMB_TYPE, size: row.thumbBytes }) : null,
  }
}

export async function startUpload(input: {
  workspaceId: string
  userId: string
  actorRole: WorkspaceMemberRole
  body: z.infer<typeof StartUploadSchema>
}): Promise<UploadTicket> {
  const b = input.body
  requireMinRole(input.actorRole, b.kind === 'attachment' ? 'member' : 'admin')
  const thumbSize = b.kind === 'attachment' ? b.thumbSize : undefined
  checkLimits(b.kind, b.contentType, b.size, thumbSize)
  const row = await withTenant(input.workspaceId, async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.workspaceId}, 0))`)
    if (b.kind === 'attachment') {
      const [task] = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, b.taskId))
      if (!task) throw new NotFoundError('Задача не найдена')
    }
    if (b.kind === 'board_image') {
      const [board] = await tx.select({ id: boards.id }).from(boards).where(eq(boards.id, b.boardId))
      if (!board) throw new NotFoundError('Доска не найдена')
    }
    const free = quotaBytes() - await usedBytes(tx, input.workspaceId)
    const need = b.size + (thumbSize ?? 0)
    if (need > free) throw new ValidationError(`Не хватает места: свободно ${formatMb(Math.max(free, 0))}, файл ${formatMb(need)}`)
    const id = crypto.randomUUID()
    const key = storageKeyFor({ fileId: id, workspaceId: input.workspaceId, userId: null })
    const [created] = await tx.insert(files).values({
      id,
      workspaceId: input.workspaceId,
      kind: b.kind,
      forComment: b.kind === 'attachment' && b.forComment,
      taskId: b.kind === 'attachment' ? b.taskId : null,
      boardId: b.kind === 'board_image' ? b.boardId : null,
      storageKey: key,
      thumbKey: thumbSize ? `${key}.thumb` : null,
      name: sanitizeFileName(b.name),
      contentType: b.contentType,
      sizeBytes: b.size,
      thumbBytes: thumbSize ?? 0,
      width: b.width ?? null,
      height: b.height ?? null,
      uploadedBy: input.userId,
    }).returning()
    return created!
  })
  return ticketFor(row, { userId: input.userId, role: input.actorRole })
}

export async function startAvatarUpload(input: { userId: string, body: z.infer<typeof StartAvatarUploadSchema> }): Promise<UploadTicket> {
  checkLimits('user_avatar', input.body.contentType, input.body.size)
  const id = crypto.randomUUID()
  const row = await withUser(input.userId, async (tx) => {
    await tx.delete(files).where(and(eq(files.kind, 'user_avatar'), eq(files.userId, input.userId), eq(files.status, 'pending')))
    const [created] = await tx.insert(files).values({
      id,
      workspaceId: null,
      kind: 'user_avatar',
      userId: input.userId,
      storageKey: storageKeyFor({ fileId: id, workspaceId: null, userId: input.userId }),
      name: sanitizeFileName(input.body.name),
      contentType: input.body.contentType,
      sizeBytes: input.body.size,
      width: input.body.width ?? null,
      height: input.body.height ?? null,
      uploadedBy: input.userId,
    }).returning()
    return created!
  })
  return ticketFor(row, { userId: input.userId, role: null })
}

export async function findFile(workspaceId: string | null, fileId: string): Promise<FileRow | undefined> {
  if (workspaceId) {
    return withTenant(workspaceId, tx =>
      tx.select().from(files).where(and(eq(files.id, fileId), eq(files.workspaceId, workspaceId))).then(r => r[0]))
  }
  return useDB().select().from(files).where(and(eq(files.id, fileId), eq(files.kind, 'user_avatar'))).then(r => r[0])
}

function inScope<T>(row: FileRow, fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  return row.workspaceId ? withTenant(row.workspaceId, fn) : withUser(row.userId!, fn)
}

async function setOwnerImage(row: FileRow): Promise<void> {
  const url = fileUrl(row)
  await inScope(row, async (tx) => {
    if (row.kind === 'user_avatar') {
      await tx.update(users).set({ avatarUrl: url }).where(eq(users.id, row.userId!))
      await tx.delete(files).where(and(eq(files.kind, 'user_avatar'), eq(files.userId, row.userId!), ne(files.id, row.id)))
    }
    if (row.kind === 'workspace_logo') {
      await tx.update(workspaces).set({ logoUrl: url }).where(eq(workspaces.id, row.workspaceId!))
      await tx.delete(files).where(and(eq(files.kind, 'workspace_logo'), eq(files.workspaceId, row.workspaceId!), ne(files.id, row.id)))
    }
    if (row.kind === 'board_image') {
      await tx.update(boards).set({ imageUrl: url }).where(eq(boards.id, row.boardId!))
      await tx.delete(files).where(and(eq(files.kind, 'board_image'), eq(files.boardId, row.boardId!), ne(files.id, row.id)))
    }
  })
}

async function announceAttachment(row: FileRow, eventType: 'task_attachment_added' | 'task_attachment_removed', actorId: string): Promise<void> {
  await withTenant(row.workspaceId!, tx =>
    tx.insert(taskEvents).values({ workspaceId: row.workspaceId!, taskId: row.taskId!, eventType, actorId, payload: { fileId: row.id, name: row.name } }))
  const task = await getTask({ workspaceId: row.workspaceId!, taskId: row.taskId!, actorRole: 'viewer' }).catch(() => null)
  if (task) publishBoardEvent({ type: 'task.updated', workspaceId: row.workspaceId!, boardId: task.boardId, payload: task })
}

export async function completeUpload(input: { workspaceId: string | null, userId: string, fileId: string }): Promise<FileView> {
  const row = await findFile(input.workspaceId, input.fileId)
  if (!row || row.uploadedBy !== input.userId || row.status !== 'pending') throw new NotFoundError('Загрузка не найдена')
  const size = await headObjectSize(row.storageKey)
  const thumbSize = row.thumbKey ? await headObjectSize(row.thumbKey) : null
  if (size !== row.sizeBytes || (row.thumbKey && thumbSize !== row.thumbBytes)) {
    await inScope(row, tx => tx.delete(files).where(eq(files.id, row.id)))
    throw new ValidationError('Файл загрузился не полностью, попробуйте ещё раз')
  }
  const status = row.forComment ? 'staged' : 'ready'
  const ready = await inScope(row, tx => tx.update(files).set({ status }).where(eq(files.id, row.id)).returning().then(r => r[0]!))
  if (ready.kind === 'attachment' && status === 'ready') await announceAttachment(ready, 'task_attachment_added', input.userId)
  if (ready.kind !== 'attachment') await setOwnerImage(ready)
  return toFileView(ready, { userId: input.userId, role: null }, await uploaderNames([ready.uploadedBy]))
}

export async function deleteFile(input: { workspaceId: string, userId: string, actorRole: WorkspaceMemberRole, fileId: string }): Promise<void> {
  const row = await findFile(input.workspaceId, input.fileId)
  if (!row || (row.status === 'staged' && row.uploadedBy !== input.userId)) throw new NotFoundError('Файл не найден')
  if (!toFileView(row, { userId: input.userId, role: input.actorRole }, new Map()).canDelete) {
    throw new ForbiddenError('Удалить файл может автор или администратор')
  }
  const url = fileUrl(row)
  await withTenant(input.workspaceId, async (tx) => {
    await tx.delete(files).where(eq(files.id, row.id))
    if (row.kind === 'workspace_logo') {
      await tx.update(workspaces).set({ logoUrl: null }).where(and(eq(workspaces.id, input.workspaceId), eq(workspaces.logoUrl, url)))
    }
    if (row.kind === 'board_image') {
      await tx.update(boards).set({ imageUrl: null }).where(and(eq(boards.id, row.boardId!), eq(boards.imageUrl, url)))
    }
  })
  if (row.kind === 'attachment' && row.status === 'ready') await announceAttachment(row, 'task_attachment_removed', input.userId)
}

export async function removeAvatar(userId: string): Promise<void> {
  await withUser(userId, async (tx) => {
    await tx.delete(files).where(and(eq(files.kind, 'user_avatar'), eq(files.userId, userId)))
    await tx.update(users).set({ avatarUrl: null }).where(eq(users.id, userId))
  })
}

async function sharesWorkspace(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true
  const [mine, theirs] = await Promise.all([listWorkspacesForUser(viewerId), listWorkspacesForUser(ownerId)])
  const ids = new Set(mine.map(w => w.id))
  return theirs.some(w => ids.has(w.id))
}

export async function resolveFileRedirect(input: {
  workspaceId: string | null
  fileId: string
  userId: string
  thumb: boolean
  download: boolean
}): Promise<{ location: string, maxAge: number }> {
  if (input.workspaceId && !(await findWorkspaceForUser(input.workspaceId, input.userId))) throw new NotFoundError('Файл не найден')
  const row = await findFile(input.workspaceId, input.fileId)
  if (!row || row.status === 'pending') throw new NotFoundError('Файл не найден')
  if (row.status === 'staged' && row.uploadedBy !== input.userId) throw new NotFoundError('Файл не найден')
  if (row.kind === 'user_avatar' && !(await sharesWorkspace(input.userId, row.userId!))) throw new NotFoundError('Файл не найден')
  const useThumb = input.thumb && !!row.thumbKey
  const contentType = useThumb ? THUMB_TYPE : row.contentType
  const windowSec = row.kind !== 'attachment' || useThumb ? IMAGE_WINDOW_SEC : ATTACHMENT_WINDOW_SEC
  const location = await presignGet({
    key: useThumb ? row.thumbKey! : row.storageKey,
    contentType,
    fileName: row.name,
    disposition: dispositionFor(contentType, input.download),
    windowSec,
  })
  return { location, maxAge: secondsLeftInWindow(windowSec) }
}

export async function listTaskFiles(input: {
  workspaceId: string
  taskId: string
  userId: string
  actorRole: WorkspaceMemberRole
}): Promise<FileView[]> {
  requireMinRole(input.actorRole, 'viewer')
  const rows = await withTenant(input.workspaceId, tx =>
    tx.select().from(files)
      .where(and(
        eq(files.taskId, input.taskId),
        eq(files.kind, 'attachment'),
        sql`(${files.status} = 'ready' OR (${files.status} = 'staged' AND ${files.uploadedBy} = ${input.userId}))`,
      ))
      .orderBy(files.createdAt),
  )
  const names = await uploaderNames(rows.map(r => r.uploadedBy))
  return rows.map(r => toFileView(r, { userId: input.userId, role: input.actorRole }, names))
}

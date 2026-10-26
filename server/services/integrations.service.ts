import { and, eq, inArray } from 'drizzle-orm'
import {
  boardFeeds,
  messengerAccounts,
  messengerLinkRequests,
  workspaceIntegrations,
  workspaceMembers,
  workspaces,
  type WorkspaceIntegration,
  type WorkspaceMemberRole,
} from '../db/schema'
import { useDB, withTenant } from '../utils/db'
import { NotFoundError, ValidationError } from '../utils/errors'
import { appUrl } from '../utils/notification-emails'
import { pachca, PachcaError } from '../utils/pachca/client'
import { roleAtLeast, requireMinRole } from '../utils/rbac'
import { openSecret, sealSecret, secretsAvailable } from '../utils/secret-box'
import { emitNotification } from './notifications.service'
import type { PachcaIntegrationView, PachcaStateResponse } from '#shared/types/integrations'

export const REQUIRED_SCOPES = ['messages:create', 'users:read', 'chats:read']

export type PachcaCtx = {
  workspaceId: string
  workspaceName: string
  token: string
  signingSecret: string | null
  botUserId: string
  emailsVisible: boolean
}

export function pachcaWebhookUrl(workspaceId: string): string {
  return `${appUrl()}/api/integrations/pachca/${workspaceId}/webhook`
}

function toView(row: WorkspaceIntegration): PachcaIntegrationView {
  return {
    status: row.status,
    botName: row.externalName,
    tokenHint: row.tokenHint,
    emailsVisible: row.emailsVisible,
    linkPreviews: !!row.signingSecretEnc,
    webhookUrl: pachcaWebhookUrl(row.workspaceId),
    lastError: row.lastError,
  }
}

async function findRow(workspaceId: string): Promise<WorkspaceIntegration | undefined> {
  return withTenant(workspaceId, tx =>
    tx.select().from(workspaceIntegrations)
      .where(and(eq(workspaceIntegrations.workspaceId, workspaceId), eq(workspaceIntegrations.provider, 'pachca')))
      .then(r => r[0]),
  )
}

async function verifyToken(token: string) {
  try {
    const info = await pachca.tokenInfo(token)
    const missing = REQUIRED_SCOPES.filter(s => !info.scopes.includes(s))
    if (missing.length) {
      throw new ValidationError(`У токена бота нет прав: ${missing.join(', ')}. Включите их в настройках бота в Пачке`)
    }
    const profile = await pachca.profile(token)
    const { users } = await pachca.users(token, { limit: 50 })
    const emailsVisible = users.some(u => !u.bot && u.id !== info.user_id && !!u.email)
    return { botUserId: String(info.user_id), botName: profile.first_name || profile.nickname, emailsVisible }
  }
  catch (err) {
    if (err instanceof PachcaError && (err.kind === 'unauthorized' || err.kind === 'forbidden')) {
      throw new ValidationError('Пачка не приняла токен. Проверьте, что скопировали токен бота целиком')
    }
    if (err instanceof PachcaError) throw new ValidationError(`Не удалось проверить токен: ${err.message}`)
    throw err
  }
}

export async function getPachcaState(input: { workspaceId: string, userId: string, actorRole: WorkspaceMemberRole }): Promise<PachcaStateResponse> {
  const row = await findRow(input.workspaceId)
  const me = row
    ? await withTenant(input.workspaceId, tx =>
        tx.select().from(messengerAccounts)
          .where(and(
            eq(messengerAccounts.workspaceId, input.workspaceId),
            eq(messengerAccounts.userId, input.userId),
            eq(messengerAccounts.provider, 'pachca'),
          ))
          .then(r => r[0]))
    : undefined
  return {
    available: secretsAvailable(),
    canManage: roleAtLeast(input.actorRole, 'admin'),
    integration: row ? toView(row) : null,
    me: me ? { displayName: me.displayName, instantTypes: me.instantTypes, digest: me.digest } : null,
  }
}

export async function connectPachca(input: {
  workspaceId: string
  actorId: string
  actorRole: WorkspaceMemberRole
  token?: string
  signingSecret?: string | null
}): Promise<PachcaIntegrationView> {
  requireMinRole(input.actorRole, 'admin')
  if (!secretsAvailable()) throw new ValidationError('На сервере не задан INTEGRATIONS_SECRET – подключение интеграций недоступно')
  const existing = await findRow(input.workspaceId)

  const token = input.token
  const tokenFields = token
    ? await verifyToken(token).then(v => ({
        botTokenEnc: sealSecret(token),
        tokenHint: token.slice(-4),
        botUserId: v.botUserId,
        externalName: v.botName,
        emailsVisible: v.emailsVisible,
        status: 'active' as const,
        lastError: null,
      }))
    : null
  const secretFields = input.signingSecret === undefined
    ? {}
    : { signingSecretEnc: input.signingSecret === null ? null : sealSecret(input.signingSecret) }

  const row = await withTenant(input.workspaceId, async (tx) => {
    if (existing) {
      const [updated] = await tx.update(workspaceIntegrations)
        .set({ ...tokenFields, ...secretFields, updatedAt: new Date() })
        .where(eq(workspaceIntegrations.id, existing.id))
        .returning()
      return updated!
    }
    if (!tokenFields) throw new ValidationError('Вставьте токен бота')
    const [created] = await tx.insert(workspaceIntegrations)
      .values({ workspaceId: input.workspaceId, provider: 'pachca', createdBy: input.actorId, ...tokenFields, ...secretFields })
      .returning()
    return created!
  })
  return toView(row)
}

export async function disconnectPachca(input: { workspaceId: string, actorRole: WorkspaceMemberRole }): Promise<void> {
  requireMinRole(input.actorRole, 'admin')
  const existing = await findRow(input.workspaceId)
  if (!existing) throw new NotFoundError('Пачка не подключена')
  await withTenant(input.workspaceId, async (tx) => {
    await tx.delete(boardFeeds).where(and(eq(boardFeeds.workspaceId, input.workspaceId), eq(boardFeeds.provider, 'pachca')))
    await tx.delete(messengerAccounts).where(and(eq(messengerAccounts.workspaceId, input.workspaceId), eq(messengerAccounts.provider, 'pachca')))
    await tx.delete(workspaceIntegrations).where(eq(workspaceIntegrations.id, existing.id))
  })
  await useDB().delete(messengerLinkRequests)
    .where(and(eq(messengerLinkRequests.workspaceId, input.workspaceId), eq(messengerLinkRequests.provider, 'pachca')))
}

export async function loadPachca(workspaceId: string): Promise<PachcaCtx | null> {
  const row = await findRow(workspaceId)
  if (!row || row.status !== 'active') return null
  const [ws] = await useDB().select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, workspaceId))
  return {
    workspaceId,
    workspaceName: ws?.name ?? '',
    token: openSecret(row.botTokenEnc),
    signingSecret: row.signingSecretEnc ? openSecret(row.signingSecretEnc) : null,
    botUserId: row.botUserId,
    emailsVisible: row.emailsVisible,
  }
}

export async function markPachcaFailed(workspaceId: string, message: string): Promise<void> {
  await withTenant(workspaceId, async (tx) => {
    const [prev] = await tx.select({ id: workspaceIntegrations.id, status: workspaceIntegrations.status })
      .from(workspaceIntegrations)
      .where(and(eq(workspaceIntegrations.workspaceId, workspaceId), eq(workspaceIntegrations.provider, 'pachca')))
      .for('update')
    if (!prev || prev.status === 'error') return
    await tx.update(workspaceIntegrations)
      .set({ status: 'error', lastError: message, updatedAt: new Date() })
      .where(eq(workspaceIntegrations.id, prev.id))
    const admins = await tx.select({ userId: workspaceMembers.userId }).from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.role, ['admin', 'owner'])))
    for (const { userId } of admins) {
      await emitNotification({ tx, workspaceId, recipientId: userId, actorId: null, type: 'integration_failed', payload: { provider: 'pachca', message } })
    }
  })
}

export async function withPachca<T>(workspaceId: string, fn: (ctx: PachcaCtx) => Promise<T>): Promise<T | null> {
  const ctx = await loadPachca(workspaceId)
  if (!ctx) return null
  try {
    return await fn(ctx)
  }
  catch (err) {
    if (err instanceof PachcaError && err.kind === 'unauthorized') {
      await markPachcaFailed(workspaceId, 'Пачка не принимает токен бота: его отозвали или бота удалили')
      return null
    }
    throw err
  }
}

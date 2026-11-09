import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull, or } from 'drizzle-orm'
import { messengerAccounts, messengerLinkRequests, users, workspaceMembers, type WorkspaceMemberRole } from '../db/schema'
import { useDB, withTenant } from '../utils/db'
import { ForbiddenError, GoneError, NotFoundError, ValidationError } from '../utils/errors'
import { appUrl } from '../utils/notification-emails'
import { pachca, pachcaUserName, PachcaError, type PachcaUser } from '../utils/pachca/client'
import { linkDoneMarkdown, linkRequestMarkdown } from '../utils/pachca/format'
import { requireMinRole } from '../utils/rbac'
import { withPachca, type PachcaCtx } from './integrations.service'
import { getWorkspaceForUserOrThrow, listWorkspacesForUser } from './workspaces.service'
import type { MyPachcaLink, PachcaCandidate, PachcaInviteResult, PachcaLinkInspect, PachcaLinkView } from '#shared/types/integrations'
import type { InstantNotificationType } from '#shared/types/notification'

const SINGLE_TTL_MS = 15 * 60_000
const BULK_TTL_MS = 7 * 86_400_000
const MAX_USER_PAGES = 40

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function userEmail(userId: string): Promise<string> {
  const [u] = await useDB().select({ email: users.email }).from(users).where(eq(users.id, userId))
  return (u?.email ?? '').toLowerCase()
}

function requireConnected<T>(value: T | null): T {
  if (value === null) throw new ValidationError('Пачка не подключена к этому пространству или работает с ошибкой')
  return value
}

async function sendLinkRequest(ctx: PachcaCtx, input: { userId: string, pachcaUser: PachcaUser, ttlMs: number }): Promise<void> {
  const token = randomBytes(32).toString('hex')
  await useDB().insert(messengerLinkRequests).values({
    tokenHash: hash(token),
    userId: input.userId,
    workspaceId: ctx.workspaceId,
    provider: 'pachca',
    externalId: String(input.pachcaUser.id),
    displayName: pachcaUserName(input.pachcaUser),
    expiresAt: new Date(Date.now() + input.ttlMs),
  })
  await pachca.sendMessage(ctx.token, {
    entityType: 'user',
    entityId: input.pachcaUser.id,
    content: linkRequestMarkdown(ctx.workspaceName),
    buttons: [[{ text: 'Подтвердить в Такте', url: `${appUrl()}/integrations/pachca/confirm/${token}` }]],
  })
}

export async function findCandidates(input: { workspaceId: string, userId: string, query: string }): Promise<PachcaCandidate[]> {
  const email = await userEmail(input.userId)
  const found = await withPachca(input.workspaceId, async (ctx) => {
    const q = input.query.trim() || (ctx.emailsVisible ? email : '')
    if (!q) return []
    const { users: list } = await pachca.users(ctx.token, { query: q, limit: 20 })
    return list.filter(u => !u.bot && !u.suspended)
  })
  return requireConnected(found).map(u => ({
    id: String(u.id),
    name: pachcaUserName(u),
    nickname: u.nickname,
    emailMatches: !!u.email && u.email.toLowerCase() === email,
  }))
}

export async function requestLink(input: { workspaceId: string, userId: string, pachcaUserId: string }): Promise<void> {
  const done = await withPachca(input.workspaceId, async (ctx) => {
    let pachcaUser: PachcaUser
    try {
      pachcaUser = await pachca.user(ctx.token, input.pachcaUserId)
    }
    catch (err) {
      if (err instanceof PachcaError && err.kind === 'not_found') throw new NotFoundError('Сотрудник не найден в Пачке')
      throw err
    }
    if (pachcaUser.bot || pachcaUser.suspended) throw new ValidationError('Этого сотрудника нельзя привязать')
    await sendLinkRequest(ctx, { userId: input.userId, pachcaUser, ttlMs: SINGLE_TTL_MS })
    return true
  })
  requireConnected(done)
}

export async function inviteAll(input: { workspaceId: string, actorRole: WorkspaceMemberRole, dryRun: boolean }): Promise<PachcaInviteResult> {
  requireMinRole(input.actorRole, 'admin')
  const result = await withPachca(input.workspaceId, async (ctx) => {
    if (!ctx.emailsVisible) throw new ValidationError('Бот не видит почты сотрудников: включите показ персональных данных в Пачке')
    const members = await withTenant(input.workspaceId, tx =>
      tx.select({ userId: workspaceMembers.userId, email: users.email })
        .from(workspaceMembers)
        .innerJoin(users, eq(users.id, workspaceMembers.userId))
        .where(eq(workspaceMembers.workspaceId, input.workspaceId)),
    )
    const linked = await withTenant(input.workspaceId, tx =>
      tx.select({ userId: messengerAccounts.userId }).from(messengerAccounts)
        .where(and(eq(messengerAccounts.workspaceId, input.workspaceId), eq(messengerAccounts.provider, 'pachca'))),
    )
    const linkedIds = new Set(linked.map(l => l.userId))
    const byEmail = new Map(members.map(m => [m.email.toLowerCase(), m.userId]))
    const matches: { userId: string, pachcaUser: PachcaUser }[] = []
    let cursor: string | undefined
    for (let page = 0; page < MAX_USER_PAGES; page++) {
      const res = await pachca.users(ctx.token, { limit: 50, cursor })
      for (const u of res.users) {
        const userId = u.email && !u.bot && !u.suspended ? byEmail.get(u.email.toLowerCase()) : undefined
        if (userId) matches.push({ userId, pachcaUser: u })
      }
      if (!res.next) break
      cursor = res.next
    }
    const toSend = matches.filter(m => !linkedIds.has(m.userId))
    let sent = 0
    if (!input.dryRun) {
      for (const m of toSend) {
        try {
          await sendLinkRequest(ctx, { userId: m.userId, pachcaUser: m.pachcaUser, ttlMs: BULK_TTL_MS })
          sent++
        }
        catch (err) {
          if (!(err instanceof PachcaError) || err.kind === 'unauthorized') throw err
        }
      }
    }
    return { members: members.length, matched: matches.length, alreadyLinked: matches.length - toSend.length, sent }
  })
  return requireConnected(result)
}

async function findRequest(token: string) {
  const [req] = await useDB().select().from(messengerLinkRequests).where(eq(messengerLinkRequests.tokenHash, hash(token)))
  return req
}

export async function inspectLink(token: string, userId: string): Promise<PachcaLinkInspect> {
  const req = await findRequest(token)
  if (!req) return { valid: false, reason: 'not_found' }
  if (req.usedAt) return { valid: false, reason: 'used' }
  if (req.expiresAt < new Date()) return { valid: false, reason: 'expired' }
  if (req.userId !== userId) return { valid: false, reason: 'other_user' }
  const ws = await getWorkspaceForUserOrThrow(req.workspaceId, userId)
  return { valid: true, workspaceName: ws.name, pachcaName: req.displayName }
}

export async function confirmLink(token: string, userId: string): Promise<void> {
  const req = await findRequest(token)
  if (!req) throw new NotFoundError('Ссылка не найдена')
  if (req.userId !== userId) throw new ForbiddenError('Эту ссылку должен подтвердить другой пользователь')
  if (req.usedAt || req.expiresAt < new Date()) throw new GoneError('Ссылка устарела – запросите привязку заново')
  await getWorkspaceForUserOrThrow(req.workspaceId, userId)
  const claimed = await useDB().update(messengerLinkRequests)
    .set({ usedAt: new Date() })
    .where(and(eq(messengerLinkRequests.id, req.id), isNull(messengerLinkRequests.usedAt)))
    .returning({ id: messengerLinkRequests.id })
  if (!claimed.length) throw new GoneError('Ссылка уже использована')
  await withTenant(req.workspaceId, async (tx) => {
    await tx.delete(messengerAccounts).where(and(
      eq(messengerAccounts.workspaceId, req.workspaceId),
      eq(messengerAccounts.provider, 'pachca'),
      or(eq(messengerAccounts.externalId, req.externalId), eq(messengerAccounts.userId, userId)),
    ))
    await tx.insert(messengerAccounts).values({
      userId,
      workspaceId: req.workspaceId,
      provider: 'pachca',
      externalId: req.externalId,
      displayName: req.displayName,
    })
  })
  await withPachca(req.workspaceId, ctx =>
    pachca.sendMessage(ctx.token, { entityType: 'user', entityId: Number(req.externalId), content: linkDoneMarkdown(ctx.workspaceName) }),
  ).catch(err => console.warn('[pachca] link confirmation message failed', err))
}

async function myLink(workspaceId: string, userId: string) {
  return withTenant(workspaceId, tx =>
    tx.select().from(messengerAccounts)
      .where(and(eq(messengerAccounts.workspaceId, workspaceId), eq(messengerAccounts.userId, userId), eq(messengerAccounts.provider, 'pachca')))
      .then(r => r[0]),
  )
}

export async function updateMyLink(input: { workspaceId: string, userId: string, instantTypes?: InstantNotificationType[], digest?: boolean }): Promise<PachcaLinkView> {
  const link = await myLink(input.workspaceId, input.userId)
  if (!link) throw new NotFoundError('Пачка не привязана')
  const [row] = await withTenant(input.workspaceId, tx =>
    tx.update(messengerAccounts)
      .set({
        ...(input.instantTypes ? { instantTypes: input.instantTypes } : {}),
        ...(input.digest !== undefined ? { digest: input.digest } : {}),
      })
      .where(eq(messengerAccounts.id, link.id))
      .returning(),
  )
  if (!row) throw new NotFoundError('Пачка не привязана')
  return { displayName: row.displayName, instantTypes: row.instantTypes, digest: row.digest }
}

export async function listMyLinks(userId: string): Promise<MyPachcaLink[]> {
  const out: MyPachcaLink[] = []
  for (const ws of await listWorkspacesForUser(userId)) {
    const link = await myLink(ws.id, userId)
    if (link) out.push({ workspaceId: ws.id, workspaceName: ws.name, instantTypes: link.instantTypes, digest: link.digest })
  }
  return out
}

export async function updateAllMyLinks(input: { userId: string, instantTypes?: InstantNotificationType[], digest?: boolean }): Promise<MyPachcaLink[]> {
  for (const link of await listMyLinks(input.userId)) {
    await updateMyLink({ workspaceId: link.workspaceId, userId: input.userId, instantTypes: input.instantTypes, digest: input.digest })
  }
  return listMyLinks(input.userId)
}

export async function dropLinks(workspaceId: string, userId: string): Promise<void> {
  await withTenant(workspaceId, tx =>
    tx.delete(messengerAccounts).where(and(eq(messengerAccounts.workspaceId, workspaceId), eq(messengerAccounts.userId, userId))),
  )
}

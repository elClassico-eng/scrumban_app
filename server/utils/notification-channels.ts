import { and, eq } from 'drizzle-orm'
import { messengerAccounts, notifications, users, type Notification } from '../db/schema'
import { withPachca } from '../services/integrations.service'
import { useDB, withTenant, withUser } from './db'
import { sendEmail } from './email'
import { describeNotification, notificationEmail, notificationLink } from './notification-emails'
import { pachca, PachcaError } from './pachca/client'
import { notificationMarkdown } from './pachca/format'
import { displayName } from '#shared/utils/display-name'

type Recipient = typeof users.$inferSelect

type ExternalChannel = {
  id: string
  deliver(recipient: Recipient, notification: Notification, actorName: string | null): Promise<void>
}

const emailChannel: ExternalChannel = {
  id: 'email',
  async deliver(r, n, actorName) {
    if (!r.emailVerifiedAt || !(r.emailPrefs.instant as string[]).includes(n.type)) return
    const payload = n.payload as Record<string, unknown>
    await sendEmail({ to: r.email, ...notificationEmail({ type: n.type, payload, actorName, link: notificationLink(n.workspaceId, payload) }) })
  },
}

const pachcaChannel: ExternalChannel = {
  id: 'pachca',
  async deliver(r, n, actorName) {
    const link = await withTenant(n.workspaceId, tx =>
      tx.select().from(messengerAccounts)
        .where(and(eq(messengerAccounts.workspaceId, n.workspaceId), eq(messengerAccounts.userId, r.id), eq(messengerAccounts.provider, 'pachca')))
        .then(rows => rows[0]),
    )
    if (!link || !(link.instantTypes as string[]).includes(n.type)) return
    const payload = n.payload as Record<string, unknown>
    try {
      await withPachca(n.workspaceId, ctx => pachca.sendMessage(ctx.token, {
        entityType: 'user',
        entityId: Number(link.externalId),
        content: notificationMarkdown(describeNotification(n.type, payload, actorName)),
        buttons: [[{ text: 'Открыть в Такте', url: notificationLink(n.workspaceId, payload) }]],
      }))
    }
    catch (err) {
      if (err instanceof PachcaError && err.kind === 'not_found') {
        await withTenant(n.workspaceId, tx => tx.delete(messengerAccounts).where(eq(messengerAccounts.id, link.id)))
        return
      }
      throw err
    }
  },
}

const CHANNELS: ExternalChannel[] = [emailChannel, pachcaChannel]

const RETRY_DELAYS_MS = [0, 500, 2000]

export function deliverExternally(input: { notificationId: string, userId: string }): void {
  void (async () => {
    for (const delay of RETRY_DELAYS_MS) {
      await new Promise(resolve => setTimeout(resolve, delay))
      const row = await withUser(input.userId, tx =>
        tx.select().from(notifications).where(eq(notifications.id, input.notificationId)).then(r => r[0]),
      )
      if (!row) continue
      await sendToChannels(row)
      return
    }
  })().catch(err => console.warn('[notifications] external delivery failed', err))
}

async function sendToChannels(n: Notification): Promise<void> {
  const [recipient] = await useDB().select().from(users).where(eq(users.id, n.userId))
  if (!recipient) return
  const actorId = (n.payload as { actorId?: unknown }).actorId
  const [actor] = typeof actorId === 'string'
    ? await useDB().select().from(users).where(eq(users.id, actorId))
    : []
  const actorName = actor ? displayName(actor) : null
  for (const channel of CHANNELS) {
    try {
      await channel.deliver(recipient, n, actorName)
    }
    catch (err) {
      console.warn(`[notifications] ${channel.id} delivery failed`, err)
    }
  }
}

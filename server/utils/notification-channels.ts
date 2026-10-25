// Delivery of in-app notifications to external channels (email now; MAX or
// Telegram later as one more entry in CHANNELS). Runs outside the request
// transaction and never fails it: the in-app notification is the source of
// truth, an external copy is best effort.
import { eq } from 'drizzle-orm'
import { notifications, users, type Notification } from '../db/schema'
import { useDB, withUser } from './db'
import { sendEmail } from './email'
import { notificationEmail, notificationLink } from './notification-emails'
import { displayName } from '#shared/utils/display-name'

type Recipient = typeof users.$inferSelect

type ExternalChannel = {
  id: string
  wants(recipient: Recipient, notification: Notification): boolean
  deliver(recipient: Recipient, notification: Notification, actorName: string | null): Promise<void>
}

const emailChannel: ExternalChannel = {
  id: 'email',
  wants: (r, n) => !!r.emailVerifiedAt && (r.emailPrefs.instant as string[]).includes(n.type),
  async deliver(r, n, actorName) {
    const mail = notificationEmail({
      type: n.type,
      payload: n.payload as Record<string, unknown>,
      actorName,
      link: notificationLink(n.workspaceId, n.payload as Record<string, unknown>),
    })
    await sendEmail({ to: r.email, ...mail })
  },
}

const CHANNELS: ExternalChannel[] = [emailChannel]

const RETRY_DELAYS_MS = [0, 500, 2000]

// The caller's transaction may not have committed yet, so the row is re-read
// on a fresh connection with a few short retries; a rolled-back notification
// simply never shows up and nothing is sent.
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
  const channels = CHANNELS.filter(c => c.wants(recipient, n))
  if (!channels.length) return
  const actorId = (n.payload as { actorId?: unknown }).actorId
  const [actor] = typeof actorId === 'string'
    ? await useDB().select().from(users).where(eq(users.id, actorId))
    : []
  const actorName = actor ? displayName(actor) : null
  for (const channel of channels) {
    try {
      await channel.deliver(recipient, n, actorName)
    }
    catch (err) {
      console.warn(`[notifications] ${channel.id} delivery failed`, err)
    }
  }
}

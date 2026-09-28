import type { H3Event } from 'h3'
import { and, eq, ne, sql } from 'drizzle-orm'
import { userSessions, type UserSession } from '../db/schema'
import { useDB } from '../utils/db'

export async function createSession(event: H3Event, userId: string): Promise<string> {
  const headers = getHeaders(event)
  const [row] = await useDB()
    .insert(userSessions)
    .values({
      userId,
      userAgent: (headers['user-agent'] ?? '').slice(0, 500) || null,
      ip: getRequestIP(event, { xForwardedFor: true })?.slice(0, 45) ?? null,
    })
    .returning({ id: userSessions.id })
  return row!.id
}

// Touch-and-check in one query: zero rows means the session was revoked.
export async function touchSession(sessionId: string): Promise<boolean> {
  const rows = await useDB()
    .update(userSessions)
    .set({ lastSeenAt: sql`now()` })
    .where(eq(userSessions.id, sessionId))
    .returning({ id: userSessions.id })
  return rows.length > 0
}

export async function deleteSession(sessionId: string): Promise<void> {
  await useDB().delete(userSessions).where(eq(userSessions.id, sessionId))
}

export async function listSessions(userId: string): Promise<UserSession[]> {
  return useDB()
    .select()
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(sql`${userSessions.lastSeenAt} desc`)
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await useDB()
    .delete(userSessions)
    .where(and(eq(userSessions.userId, userId), eq(userSessions.id, sessionId)))
}

export async function revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
  const rows = await useDB()
    .delete(userSessions)
    .where(and(eq(userSessions.userId, userId), ne(userSessions.id, currentSessionId)))
    .returning({ id: userSessions.id })
  return rows.length
}

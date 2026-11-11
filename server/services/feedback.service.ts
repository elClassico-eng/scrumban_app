import { desc } from 'drizzle-orm'
import { feedback, type NewFeedback } from '../db/schema'

export async function createFeedback(input: NewFeedback) {
  const [row] = await useDB().insert(feedback).values(input).returning()
  return row!
}

export async function listFeedback(limit = 500) {
  return useDB().select().from(feedback).orderBy(desc(feedback.createdAt)).limit(limit)
}

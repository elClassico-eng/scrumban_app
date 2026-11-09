import { feedback, type NewFeedback } from '../db/schema'

export async function createFeedback(input: NewFeedback) {
  const [row] = await useDB().insert(feedback).values(input).returning()
  return row!
}

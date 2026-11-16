import { desc } from 'drizzle-orm'
import { leads } from '../db/schema'

export type CreateLeadInput = {
  email: string
  teamSize: string | null
  currentTool: string | null
  consentAt: Date
}

export async function createLead(input: CreateLeadInput) {
  const [row] = await useDB().insert(leads).values(input).returning()
  return row
}

export async function listLeads(limit = 500) {
  return useDB().select().from(leads).orderBy(desc(leads.createdAt)).limit(limit)
}

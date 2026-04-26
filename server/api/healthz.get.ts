// GET /api/healthz — liveness + DB-ping. Returns 200 if PostgreSQL responds
// to SELECT 1. Used by uptime probes and to confirm wiring during development.
import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  await useDB().execute(sql`select 1`)
  return { ok: true, db: 'connected' }
})

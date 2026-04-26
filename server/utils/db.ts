// Drizzle ORM client, lazily constructed on first useDB() call so module-load
// time stays fast and we never try to open a connection during build.
// Nitro auto-imports this util into the rest of server/, so handlers and
// services can call useDB() without an explicit import.
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

export function useDB() {
  if (_db) return _db

  const { databaseUrl } = useRuntimeConfig()
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set (check .env or runtimeConfig)')
  }

  const client = postgres(databaseUrl, { max: 20 })
  _db = drizzle(client, { schema })
  return _db
}

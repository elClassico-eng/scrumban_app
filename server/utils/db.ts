// Drizzle ORM client, lazily constructed on first useDB() call so module-load
// time stays fast and we never try to open a connection during build.
// Nitro auto-imports this util into the rest of server/, so handlers and
// services can call useDB() without an explicit import.
//
// withTenant() wraps a callback in a transaction that first sets
// app.workspace_id via set_config(...). All RLS policies on Phase 2
// tables filter by this GUC, so any code that touches tenant-scoped data
// MUST go through withTenant() — bare useDB().select() against tasks,
// boards, etc. will return zero rows by design.
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
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

export type Db = ReturnType<typeof useDB>
export type DbTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]

// Runs the callback in a transaction with `app.workspace_id` set to the
// given workspaceId. Use the `tx` parameter (not useDB()) inside the
// callback; queries via `tx` participate in the transaction and see the
// tenant GUC, queries via the bare connection do not.
//
// Use set_config(..., is_local=true) instead of SET LOCAL: functionally equivalent
// (transaction-scoped) but accepts $1 placeholders that SET LOCAL syntactically rejects.
export async function withTenant<T>(
  workspaceId: string,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return useDB().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`)
    return fn(tx)
  })
}

export async function withUser<T>(
  userId: string,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return useDB().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`)
    return fn(tx)
  })
}

export async function setUserContext(tx: DbTransaction, userId: string): Promise<void> {
  await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`)
}

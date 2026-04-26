// Vitest globalSetup: runs once before any test file. Recreates the
// scrumban_test database from scratch and applies all Drizzle migrations
// so each `bun test` run starts with a known clean schema.
//
// Per-test row cleanup (TRUNCATE) is in tests/helpers/db.ts.
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const ADMIN_URL = 'postgresql://scrumban:scrumban@localhost:5433/postgres'
const TEST_DB = 'scrumban_test'
export const TEST_URL = `postgresql://scrumban:scrumban@localhost:5433/${TEST_DB}`

export default async function setup() {
  const admin = postgres(ADMIN_URL, { max: 1 })
  try {
    // Force-drop with active connections terminated, then recreate.
    await admin.unsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()
    `)
    await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`)
    await admin.unsafe(`CREATE DATABASE "${TEST_DB}"`)
  } finally {
    await admin.end()
  }

  const test = postgres(TEST_URL, { max: 1 })
  try {
    await migrate(drizzle(test), { migrationsFolder: './drizzle/migrations' })
  } finally {
    await test.end()
  }
}

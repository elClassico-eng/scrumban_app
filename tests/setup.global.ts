// Vitest globalSetup: runs once before any test file. Recreates the
// scrumban_test database from scratch, applies migrations as the admin
// role, then grants runtime DML to scrumban_app so e2e tests can hit it
// while RLS still applies (scrumban_app is non-superuser, non-bypassrls).
//
// Per-test row cleanup (TRUNCATE) is in tests/helpers/db.ts and uses the
// admin URL (only the table owner / a superuser can TRUNCATE here).
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const TEST_DB = 'scrumban_test'

const ADMIN_BASE = 'postgresql://scrumban:scrumban@localhost:5433'
const APP_BASE = 'postgresql://scrumban_app:scrumban_app@localhost:5433'

export const ADMIN_URL = `${ADMIN_BASE}/${TEST_DB}`
export const TEST_URL = `${APP_BASE}/${TEST_DB}`
const SERVER_URL = `${ADMIN_BASE}/postgres`

export default async function setup() {
  const server = postgres(SERVER_URL, { max: 1 })
  try {
    // Force-drop with active connections terminated, then recreate.
    await server.unsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()
    `)
    await server.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`)
    await server.unsafe(`CREATE DATABASE "${TEST_DB}"`)
  } finally {
    await server.end()
  }

  const admin = postgres(ADMIN_URL, { max: 1 })
  try {
    await migrate(drizzle(admin), { migrationsFolder: './drizzle/migrations' })
    // Grant runtime DML to the app role on the freshly created DB.
    // ALTER DEFAULT PRIVILEGES (in init script) only covers FUTURE tables
    // owned by scrumban; the migrate run above created tables in *this*
    // database, so we grant explicitly.
    await admin.unsafe(`GRANT CONNECT ON DATABASE "${TEST_DB}" TO scrumban_app`)
    await admin.unsafe('GRANT USAGE ON SCHEMA public TO scrumban_app')
    await admin.unsafe(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scrumban_app',
    )
    await admin.unsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scrumban_app')
  } finally {
    await admin.end()
  }
}

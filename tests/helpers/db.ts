// Per-test DB helpers. Connection is opened lazily on first call and
// closed via afterAll() in the test files that use it.
//
// Uses ADMIN_URL (scrumban superuser) — TRUNCATE requires the table owner
// or superuser; scrumban_app does not have that privilege.
import postgres from 'postgres'
import { ADMIN_URL } from '../setup.global'

let _client: ReturnType<typeof postgres> | null = null

export function getTestSql() {
  if (!_client) _client = postgres(ADMIN_URL, { max: 1 })
  return _client
}

export async function closeTestSql() {
  if (_client) {
    await _client.end()
    _client = null
  }
}

// Wipes all rows but keeps schema. CASCADE handles FK references.
// Workspace tables come first because they reference users.
export async function resetDb() {
  const sql = getTestSql()
  await sql.unsafe(
    'TRUNCATE TABLE "workspace_members", "workspaces", "users" RESTART IDENTITY CASCADE',
  )
}

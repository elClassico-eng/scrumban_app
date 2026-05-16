import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL
if (!url) {
  console.error('[migrate] DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(url, { max: 1, onnotice: () => {} })
const db = drizzle(sql)

try {
  console.log('[migrate] applying migrations from ./drizzle/migrations ...')
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
  console.log('[migrate] done')
}
catch (err) {
  console.error('[migrate] failed:', err)
  process.exit(1)
}
finally {
  await sql.end({ timeout: 5 })
}

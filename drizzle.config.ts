// Drizzle Kit reads this when generating/applying migrations.
// It runs as a standalone CLI (not inside Nuxt), so we read DATABASE_URL
// from process.env (Bun auto-loads .env). Schema source of truth lives
// in server/db/schema; generated SQL goes into drizzle/migrations.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
})

// Users table: the authentication subject. Password is stored as a scrypt
// hash via nuxt-auth-utils hashPassword(); scrypt is built into Node and is
// the library default. Argon2id is supported but requires @node-rs/argon2
// (not installed). Email uniqueness is enforced at the DB level; case-folding
// to lowercase is the responsibility of the service layer.
import { jsonb, pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  middleName: varchar('middle_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  jobTitle: varchar('job_title', { length: 150 }),
  bio: text('bio'),
  // One-time UI hints the user has dismissed (e.g. onboarding blocks),
  // keyed by string identifiers like 'simulator-intro'.
  dismissedHints: jsonb('dismissed_hints').$type<string[]>().notNull().default([]),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  changelogSeenAt: timestamp('changelog_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

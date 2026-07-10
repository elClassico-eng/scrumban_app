// UsersService: thin business-logic layer over the users table.
// Normalises email to lowercase for predictable lookups, and translates
// PostgreSQL unique-violation errors into a domain ConflictError so the
// HTTP layer can map it to 409 without sniffing pg error codes itself.
import { eq, sql } from 'drizzle-orm'
import { users, type User } from '../db/schema'
import { ConflictError, NotFoundError } from '../utils/errors'

const PG_UNIQUE_VIOLATION = '23505'

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const [row] = await useDB().select().from(users).where(eq(users.email, normaliseEmail(email)))
  return row
}

export async function findUserById(id: string): Promise<User | undefined> {
  const [row] = await useDB().select().from(users).where(eq(users.id, id))
  return row
}

export interface CreateUserInput {
  email: string
  passwordHash: string
  firstName?: string | null
  lastName?: string | null
  middleName?: string | null
}

type UsersTx = Parameters<Parameters<ReturnType<typeof useDB>['transaction']>[0]>[0]

export async function createUserInTx(tx: UsersTx, input: CreateUserInput): Promise<User> {
  try {
    const [row] = await tx
      .insert(users)
      .values({
        email: normaliseEmail(input.email),
        passwordHash: input.passwordHash,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        middleName: input.middleName ?? null,
      })
      .returning()
    return row!
  } catch (err: unknown) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Этот email уже зарегистрирован')
    }
    throw err
  }
}

export async function createUser(input: CreateUserInput): Promise<User> {
  return useDB().transaction(tx => createUserInTx(tx, input))
}

export async function updateUserProfile(input: {
  userId: string
  patch: {
    firstName?: string | null
    lastName?: string | null
    middleName?: string | null
    avatarUrl?: string | null
    jobTitle?: string | null
    bio?: string | null
  }
}): Promise<User> {
  const set: Partial<typeof users.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  }
  if ('firstName' in input.patch) set.firstName = input.patch.firstName ?? null
  if ('lastName' in input.patch) set.lastName = input.patch.lastName ?? null
  if ('middleName' in input.patch) set.middleName = input.patch.middleName ?? null
  if ('avatarUrl' in input.patch) set.avatarUrl = input.patch.avatarUrl ?? null
  if ('jobTitle' in input.patch) set.jobTitle = input.patch.jobTitle ?? null
  if ('bio' in input.patch) set.bio = input.patch.bio ?? null

  const [row] = await useDB()
    .update(users)
    .set(set)
    .where(eq(users.id, input.userId))
    .returning()
  if (!row) throw new NotFoundError('Пользователь не найден')
  return row
}

function isPgUniqueViolation(err: unknown): boolean {
  // Drizzle wraps the original postgres-js error inside DrizzleQueryError;
  // check both the wrapper and its `cause`.
  const candidate =
    typeof err === 'object' && err !== null && 'cause' in err
      ? (err as { cause?: unknown }).cause
      : err
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'code' in candidate &&
    candidate.code === PG_UNIQUE_VIOLATION
  )
}

export async function dismissHint(userId: string, key: string): Promise<string[]> {
  const keyJson = JSON.stringify([key])
  const [row] = await useDB()
    .update(users)
    .set({
      dismissedHints: sql`CASE
        WHEN ${users.dismissedHints} @> ${keyJson}::jsonb THEN ${users.dismissedHints}
        ELSE ${users.dismissedHints} || ${keyJson}::jsonb
      END`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ dismissedHints: users.dismissedHints })
  if (!row) throw new NotFoundError('Пользователь не найден')
  return row.dismissedHints
}

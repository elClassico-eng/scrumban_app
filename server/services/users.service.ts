// UsersService: thin business-logic layer over the users table.
// Normalises email to lowercase for predictable lookups, and translates
// PostgreSQL unique-violation errors into a domain ConflictError so the
// HTTP layer can map it to 409 without sniffing pg error codes itself.
import { eq } from 'drizzle-orm'
import { users, type User } from '../db/schema'
import { ConflictError } from '../utils/errors'

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

export async function createUser(input: {
  email: string
  passwordHash: string
}): Promise<User> {
  try {
    const [row] = await useDB()
      .insert(users)
      .values({
        email: normaliseEmail(input.email),
        passwordHash: input.passwordHash,
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

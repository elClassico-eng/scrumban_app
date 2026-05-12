// Domain error classes. Throw them anywhere in services/, then a single
// helper (or H3's defaultErrorHandler with `mapError` re-throw) converts
// them to the right HTTP status. Keeps handlers free of try/catch noise.
export class NotFoundError extends Error {
  readonly statusCode = 404
}
export class ForbiddenError extends Error {
  readonly statusCode = 403
}
export class ConflictError extends Error {
  readonly statusCode = 409
}
export class ValidationError extends Error {
  readonly statusCode = 422
}
export class UnauthorizedError extends Error {
  readonly statusCode = 401
}

type DomainError =
  | NotFoundError
  | ForbiddenError
  | ConflictError
  | ValidationError
  | UnauthorizedError

export function isDomainError(err: unknown): err is DomainError {
  return (
    err instanceof NotFoundError ||
    err instanceof ForbiddenError ||
    err instanceof ConflictError ||
    err instanceof ValidationError ||
    err instanceof UnauthorizedError
  )
}

// Maps a domain error to H3's createError shape. Use at handler boundaries:
//   try { ... } catch (e) { throw toHttpError(e) }
//
// Convention: human-readable Russian message is always in `data.message` so
// the frontend can show it directly. Zod issues are also passed through for
// field-level rendering in forms.
export function toHttpError(err: unknown) {
  if (isDomainError(err)) {
    return createError({
      statusCode: err.statusCode,
      statusMessage: err.message,
      data: { message: err.message },
    })
  }
  if (isZodError(err)) {
    const first = err.issues[0] as { message?: string } | undefined
    const message = first?.message ?? 'Неверные данные'
    return createError({
      statusCode: 400,
      statusMessage: message,
      data: { message, issues: err.issues },
    })
  }
  return err
}

function isZodError(err: unknown): err is { issues: Array<{ message?: string }>; name: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'ZodError' &&
    Array.isArray((err as { issues?: unknown[] }).issues)
  )
}

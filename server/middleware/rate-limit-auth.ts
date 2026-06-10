import type { H3Event } from 'h3'

type Bucket = { count: number, resetAt: number }

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const TARGET_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/password/forgot',
  '/api/auth/password/reset',
])
const buckets = new Map<string, Bucket>()

function getClientIp(event: H3Event): string {
  // Trust only the LAST X-Forwarded-For element. Our single reverse proxy
  // (Caddy) appends the real client IP at the end of the chain, and the app
  // container is not publicly reachable except through it. The FIRST element
  // is whatever the client sent — trivially spoofable, so keying the limiter
  // on it lets an attacker mint a fresh bucket per request and bypass it.
  const xff = getRequestHeader(event, 'x-forwarded-for')
  if (xff) {
    const parts = xff.split(',')
    return parts[parts.length - 1]!.trim()
  }
  const xreal = getRequestHeader(event, 'x-real-ip')
  if (xreal) return xreal.trim()
  return event.node.req.socket?.remoteAddress ?? 'unknown'
}

function sweepExpired(now: number) {
  if (buckets.size < 1000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}

export default defineEventHandler(async (event) => {
  const path = event.path?.split('?')[0]
  if (!path || !TARGET_PATHS.has(path)) return
  if (event.method !== 'POST') return

  const ip = getClientIp(event)
  let email = ''
  try {
    const body = await readBody<{ email?: unknown }>(event)
    if (typeof body?.email === 'string') email = body.email.toLowerCase().trim()
  }
  catch {
    // malformed body — fall through, key on IP only
  }

  const key = `${path}::${ip}::${email}`
  const now = Date.now()
  sweepExpired(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  if (bucket.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    setResponseHeader(event, 'Retry-After', String(retryAfter))
    const message = 'Слишком много попыток. Попробуйте через несколько минут.'
    throw createError({
      statusCode: 429,
      statusMessage: message,
      message,
      data: { message, retryAfter },
    })
  }

  bucket.count += 1
})

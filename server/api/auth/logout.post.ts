// POST /api/auth/logout — clears the signed session cookie.
// Idempotent: returns ok=true even if there was no active session.
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})

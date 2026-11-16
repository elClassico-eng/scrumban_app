import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_SKEW_SEC = 60
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const BOARD_PATH = new RegExp(`^/workspaces/(${UUID})/boards/(${UUID})/?$`, 'i')
const UUID_ONLY = new RegExp(`^${UUID}$`, 'i')

export function verifyPachcaSignature(raw: string, signature: string | undefined, secret: string, nowSec: number): boolean {
  if (!signature) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  try {
    const ts = (JSON.parse(raw) as { webhook_timestamp?: unknown }).webhook_timestamp
    return typeof ts === 'number' && Math.abs(nowSec - ts) <= MAX_SKEW_SEC
  }
  catch {
    return false
  }
}

export function parseTaktLink(url: string, appUrl: string): { workspaceId: string, boardId: string, taskId: string | null } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return null
  }
  if (parsed.host !== new URL(appUrl).host) return null
  const m = parsed.pathname.match(BOARD_PATH)
  if (!m) return null
  const task = parsed.searchParams.get('task')
  return { workspaceId: m[1]!.toLowerCase(), boardId: m[2]!.toLowerCase(), taskId: task && UUID_ONLY.test(task) ? task.toLowerCase() : null }
}

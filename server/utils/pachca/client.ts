export type PachcaErrorKind = 'unauthorized' | 'forbidden' | 'not_found' | 'rate_limited' | 'invalid' | 'unavailable'

export class PachcaError extends Error {
  constructor(readonly kind: PachcaErrorKind, message: string, readonly retryAfterSec: number | null = null) {
    super(message)
  }
}

export type PachcaUser = {
  id: number
  first_name: string | null
  last_name: string | null
  nickname: string
  email: string | null
  bot: boolean
  suspended: boolean
}

type Paginated<T> = { data: T[], meta?: { paginate?: { next_page?: string | null } } }

const KIND_BY_STATUS: Record<number, PachcaErrorKind> = {
  400: 'invalid',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  422: 'invalid',
  429: 'rate_limited',
}

function base(): string {
  return (process.env.PACHCA_API_BASE ?? 'https://api.pachca.com/api/shared/v1').replace(/\/+$/, '')
}

function errorMessage(text: string, status: number): string {
  try {
    const body = JSON.parse(text) as { errors?: { message?: string }[], error_description?: string }
    return body.errors?.[0]?.message ?? body.error_description ?? `Пачка ответила ${status}`
  }
  catch {
    return `Пачка ответила ${status}`
  }
}

async function call<T>(token: string, method: string, path: string, body?: unknown, retried = false): Promise<T> {
  let res: Response
  try {
    res = await fetch(base() + path, {
      method,
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'Takt (takt34.tech)',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
  }
  catch {
    throw new PachcaError('unavailable', 'Пачка не отвечает')
  }
  const retryAfter = res.headers.get('retry-after')
  if (res.status === 429 && !retried) {
    await new Promise(resolve => setTimeout(resolve, Math.min(Number(retryAfter ?? 1), 10) * 1000))
    return call(token, method, path, body, true)
  }
  const text = await res.text()
  if (!res.ok) {
    throw new PachcaError(KIND_BY_STATUS[res.status] ?? 'unavailable', errorMessage(text, res.status), retryAfter ? Number(retryAfter) : null)
  }
  return (text ? JSON.parse(text) : undefined) as T
}

function query(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export function pachcaUserName(u: PachcaUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.nickname
}

export const pachca = {
  tokenInfo: (token: string) =>
    call<{ data: { user_id: number, scopes: string[] } }>(token, 'GET', '/oauth/token/info').then(r => r.data),
  profile: (token: string) =>
    call<{ data: PachcaUser }>(token, 'GET', '/profile').then(r => r.data),
  user: (token: string, id: string) =>
    call<{ data: PachcaUser }>(token, 'GET', `/users/${id}`).then(r => r.data),
  users: (token: string, opts: { query?: string, limit?: number, cursor?: string }) =>
    call<Paginated<PachcaUser>>(token, 'GET', `/users${query({ query: opts.query, limit: opts.limit ?? 50, cursor: opts.cursor })}`)
      .then(r => ({ users: r.data, next: r.data.length ? r.meta?.paginate?.next_page ?? null : null })),
  chats: (token: string, cursor?: string) =>
    call<Paginated<{ id: number, name: string }>>(token, 'GET', `/chats${query({ limit: 50, cursor })}`)
      .then(r => ({ chats: r.data, next: r.data.length ? r.meta?.paginate?.next_page ?? null : null })),
  sendMessage: (token: string, msg: { entityType: 'user' | 'discussion', entityId: number, content: string, buttons?: { text: string, url: string }[][] }) =>
    call<{ data: { id: number } }>(token, 'POST', '/messages', {
      message: { entity_type: msg.entityType, entity_id: msg.entityId, content: msg.content, buttons: msg.buttons },
    }).then(r => r.data),
  linkPreviews: (token: string, messageId: number, previews: Record<string, { title: string, description: string }>) =>
    call<undefined>(token, 'POST', `/messages/${messageId}/link_previews`, { link_previews: previews }),
}

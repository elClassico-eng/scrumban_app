import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'

export type FakeUser = { id: number, first_name: string, last_name: string, nickname: string, email: string | null, bot: boolean, suspended: boolean }
export type FakeMessage = { id: number, entity_type: string, entity_id: number, content: string, buttons?: { text: string, url: string }[][] }
export type FakePreview = { messageId: number, link_previews: Record<string, { title: string, description: string }> }

export type FakeState = {
  tokens: Map<string, { userId: number, scopes: string[] }>
  users: FakeUser[]
  chats: { id: number, name: string }[]
  messages: FakeMessage[]
  previews: FakePreview[]
  failures: { path: string, status: number, left: number }[]
}

export type FakePachca = {
  url: string
  state: FakeState
  fail: (path: string, status: number, times?: number) => void
  reset: () => void
  close: () => Promise<void>
}

export const ALL_SCOPES = ['messages:create', 'users:read', 'chats:read', 'link_previews:write', 'profile:read']

function fresh(): FakeState {
  return { tokens: new Map(), users: [], chats: [], messages: [], previews: [], failures: [] }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : undefined
}

export async function startFakePachca(): Promise<FakePachca> {
  let state = fresh()
  let seq = 1000
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake')
    const send = (status: number, body?: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', ...(status === 429 ? { 'retry-after': '0' } : {}) })
      res.end(body === undefined ? '' : JSON.stringify(body))
    }
    const failure = state.failures.find(f => url.pathname.startsWith(f.path) && f.left > 0)
    if (failure) {
      failure.left--
      return send(failure.status, { errors: [{ message: 'fake failure' }] })
    }
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? ''
    const owner = state.tokens.get(token)
    if (!owner) return send(401, { error: 'invalid_token', error_description: 'Access token is invalid' })

    if (req.method === 'GET' && url.pathname === '/oauth/token/info') {
      return send(200, { data: { user_id: owner.userId, scopes: owner.scopes } })
    }
    if (req.method === 'GET' && url.pathname === '/profile') {
      return send(200, { data: { id: owner.userId, first_name: 'Такт', last_name: '', nickname: 'takt_bot', email: null, bot: true, suspended: false } })
    }
    if (req.method === 'GET' && url.pathname.startsWith('/users/')) {
      const u = state.users.find(x => String(x.id) === url.pathname.split('/')[2])
      return u ? send(200, { data: u }) : send(404, { errors: [{ message: 'not found' }] })
    }
    if (req.method === 'GET' && url.pathname === '/users') {
      const q = (url.searchParams.get('query') ?? '').toLowerCase()
      const matched = state.users.filter(u => !q || [u.first_name, u.last_name, u.nickname, u.email ?? ''].some(f => f.toLowerCase().includes(q)))
      const offset = Number(url.searchParams.get('cursor') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 50)
      const page = matched.slice(offset, offset + limit)
      const next = offset + limit < matched.length ? String(offset + limit) : null
      return send(200, { data: page, meta: { paginate: { next_page: next } } })
    }
    if (req.method === 'GET' && url.pathname === '/chats') {
      return send(200, { data: state.chats, meta: { paginate: { next_page: null } } })
    }
    if (req.method === 'POST' && url.pathname === '/messages') {
      const body = await readBody(req) as { message: Omit<FakeMessage, 'id'> }
      const id = ++seq
      state.messages.push({ id, ...body.message })
      return send(201, { data: { id } })
    }
    const previewMatch = url.pathname.match(/^\/messages\/(\d+)\/link_previews$/)
    if (req.method === 'POST' && previewMatch) {
      const body = await readBody(req) as Omit<FakePreview, 'messageId'>
      state.previews.push({ messageId: Number(previewMatch[1]), ...body })
      return send(204)
    }
    return send(404, { errors: [{ message: `fake: no route ${req.method} ${url.pathname}` }] })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    get state() {
      return state
    },
    fail: (path, status, times = 1) => {
      state.failures.push({ path, status, left: times })
    },
    reset: () => {
      state = fresh()
    },
    close: () => new Promise(resolve => server.close(() => resolve())),
  }
}

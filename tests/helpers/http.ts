// Tiny cookie-jar helpers around plain fetch. We talk to the dev server
// booted by @nuxt/test-utils via its base URL — that path keeps cookie
// handling under our control (which $fetch wrappers obscure).
import { useTestContext } from '@nuxt/test-utils/e2e'

export class CookieJar {
  private cookies = new Map<string, string>()

  get header(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
  }

  capture(setCookieHeaders: string[] | null | undefined): void {
    if (!setCookieHeaders) return
    for (const raw of setCookieHeaders) {
      const [pair] = raw.split(';')
      const eq = pair?.indexOf('=') ?? -1
      if (eq <= 0) continue
      const name = pair!.slice(0, eq).trim()
      const value = pair!.slice(eq + 1).trim()
      if (
        value === '' ||
        /Max-Age=0/i.test(raw) ||
        /Expires=Thu, 01 Jan 1970/i.test(raw)
      ) {
        this.cookies.delete(name)
      } else {
        this.cookies.set(name, value)
      }
    }
  }

  clear(): void {
    this.cookies.clear()
  }
}

function baseUrl(): string {
  const ctx = useTestContext()
  if (!ctx.url) throw new Error('Test context has no URL — was setup() called?')
  return ctx.url.replace(/\/$/, '')
}

export interface HttpResult<T> {
  status: number
  body: T
}

export async function fetchWithJar<T = unknown>(
  jar: CookieJar,
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<HttpResult<T>> {
  const url = baseUrl() + path
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...init.headers,
  }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  if (jar.header) headers.cookie = jar.header

  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  jar.capture(res.headers.getSetCookie())

  let body: unknown
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    body = await res.json()
  } else {
    body = await res.text()
  }
  return { status: res.status, body: body as T }
}

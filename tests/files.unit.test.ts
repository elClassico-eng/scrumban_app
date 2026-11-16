import { describe, expect, it } from 'vitest'
import { contentDisposition, dispositionFor, fileUrl, sanitizeFileName, storageKeyFor } from '../server/utils/files'
import { presignGet, secondsLeftInWindow } from '../server/utils/storage'

process.env.S3_ENDPOINT = 'http://localhost:9000'
process.env.S3_REGION = 'us-east-1'
process.env.S3_BUCKET = 'takt-test'
process.env.S3_ACCESS_KEY_ID = 'takt'
process.env.S3_SECRET_ACCESS_KEY = 'takt-dev-secret'

describe('file rules', () => {
  it('sanitizes names', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFileName('C:\\Users\\me\\отчёт.pdf')).toBe('отчёт.pdf')
    expect(sanitizeFileName('a\u0000b\nc.txt')).toBe('abc.txt')
    expect(sanitizeFileName('   ')).toBe('file')
    expect(sanitizeFileName('x'.repeat(300) + '.png').length).toBe(255)
  })

  it('opens only safe types inline', () => {
    expect(dispositionFor('image/png', false)).toBe('inline')
    expect(dispositionFor('application/pdf', false)).toBe('inline')
    expect(dispositionFor('image/svg+xml', false)).toBe('attachment')
    expect(dispositionFor('text/html', false)).toBe('attachment')
    expect(dispositionFor('image/png', true)).toBe('attachment')
  })

  it('encodes cyrillic file names', () => {
    expect(contentDisposition('attachment', 'отчёт.pdf')).toBe(`attachment; filename="file.pdf"; filename*=UTF-8''${encodeURIComponent('отчёт.pdf')}`)
  })

  it('builds keys and urls', () => {
    expect(storageKeyFor({ fileId: 'f', workspaceId: 'w', userId: null })).toBe('ws/w/f')
    expect(storageKeyFor({ fileId: 'f', workspaceId: null, userId: 'u' })).toBe('users/u/f')
    expect(fileUrl({ id: 'f', workspaceId: 'w' }, { thumb: true })).toBe('/api/files/w/w/f?thumb=1')
    expect(fileUrl({ id: 'f', workspaceId: null })).toBe('/api/files/u/f')
  })
})

describe('windowed signing', () => {
  const input = { key: 'ws/w/f', contentType: 'image/png', fileName: 'a.png', disposition: 'inline' as const, windowSec: 3600 }

  it('is stable inside a window and changes in the next one', async () => {
    const a = await presignGet(input, new Date('2026-10-27T10:05:00Z'))
    const b = await presignGet(input, new Date('2026-10-27T10:55:00Z'))
    const c = await presignGet(input, new Date('2026-10-27T11:01:00Z'))
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toContain('response-cache-control')
  })

  it('reports seconds left in the window', () => {
    expect(secondsLeftInWindow(3600, new Date('2026-10-27T10:59:00Z'))).toBe(60)
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import { openSecret, sealSecret, secretsAvailable } from '../server/utils/secret-box'

const KEY = Buffer.alloc(32, 7).toString('base64')

afterEach(() => {
  delete process.env.INTEGRATIONS_SECRET
})

describe('secret-box', () => {
  it('round-trips and never repeats ciphertext', () => {
    process.env.INTEGRATIONS_SECRET = KEY
    const a = sealSecret('pachca-token-123')
    const b = sealSecret('pachca-token-123')
    expect(a.startsWith('v1:')).toBe(true)
    expect(a).not.toBe(b)
    expect(openSecret(a)).toBe('pachca-token-123')
  })

  it('rejects tampered ciphertext', () => {
    process.env.INTEGRATIONS_SECRET = KEY
    const [v, iv, tag, data] = sealSecret('secret').split(':')
    const flipped = Buffer.from(data!, 'base64')
    flipped[0] = flipped[0]! ^ 1
    expect(() => openSecret([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow()
  })

  it('rejects a truncated auth tag', () => {
    process.env.INTEGRATIONS_SECRET = KEY
    const [v, iv, tag, data] = sealSecret('secret').split(':')
    const short = Buffer.from(tag!, 'base64').subarray(0, 4).toString('base64')
    expect(() => openSecret([v, iv, short, data].join(':'))).toThrow()
  })

  it('reports a missing or malformed key', () => {
    expect(secretsAvailable()).toBe(false)
    expect(() => sealSecret('x')).toThrow('INTEGRATIONS_SECRET')
    process.env.INTEGRATIONS_SECRET = Buffer.alloc(16).toString('base64')
    expect(secretsAvailable()).toBe(false)
  })
})

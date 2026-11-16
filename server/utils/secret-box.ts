import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const VERSION = 'v1'
const IV_BYTES = 12
const TAG_BYTES = 16

function key(): Buffer {
  const raw = process.env.INTEGRATIONS_SECRET
  if (!raw) throw new Error('INTEGRATIONS_SECRET is not set')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length !== 32) throw new Error('INTEGRATIONS_SECRET must be 32 bytes in base64')
  return buf
}

export function secretsAvailable(): boolean {
  try {
    key()
    return true
  }
  catch {
    return false
  }
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key(), iv, { authTagLength: TAG_BYTES })
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(':')
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unknown secret format')
  const ivBuf = Buffer.from(iv, 'base64')
  const tagBuf = Buffer.from(tag, 'base64')
  if (ivBuf.length !== IV_BYTES || tagBuf.length !== TAG_BYTES) throw new Error('Unknown secret format')
  const decipher = createDecipheriv('aes-256-gcm', key(), ivBuf, { authTagLength: TAG_BYTES })
  decipher.setAuthTag(tagBuf)
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

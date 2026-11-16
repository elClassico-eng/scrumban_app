import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { contentDisposition } from './files'

const PUT_EXPIRES_SEC = 600
const IMMUTABLE = 'private, max-age=31536000, immutable'

let client: S3Client | null = null

function s3(): S3Client {
  if (client) return client
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env
  if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error('S3_ENDPOINT / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not set')
  }
  client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION || 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
  })
  return client
}

export function storageBucket(): string {
  const bucket = process.env.S3_BUCKET
  if (!bucket) throw new Error('S3_BUCKET is not set')
  return bucket
}

export function presignPut(input: { key: string, contentType: string, size: number }): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: storageBucket(), Key: input.key, ContentType: input.contentType, ContentLength: input.size }),
    { expiresIn: PUT_EXPIRES_SEC, signableHeaders: new Set(['content-type', 'content-length']) },
  )
}

function windowStart(windowSec: number, now: Date): Date {
  const ms = windowSec * 1000
  return new Date(Math.floor(now.getTime() / ms) * ms)
}

export function secondsLeftInWindow(windowSec: number, now = new Date()): number {
  return Math.ceil((windowStart(windowSec, now).getTime() + windowSec * 1000 - now.getTime()) / 1000)
}

export function presignGet(
  input: { key: string, contentType: string, fileName: string, disposition: 'inline' | 'attachment', windowSec: number },
  now = new Date(),
): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: storageBucket(),
      Key: input.key,
      ResponseContentType: input.contentType,
      ResponseContentDisposition: contentDisposition(input.disposition, input.fileName),
      ResponseCacheControl: IMMUTABLE,
    }),
    { expiresIn: input.windowSec * 2, signingDate: windowStart(input.windowSec, now) },
  )
}

export async function headObjectSize(key: string): Promise<number | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: storageBucket(), Key: key }))
    return res.ContentLength ?? null
  }
  catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status === 404) return null
    throw err
  }
}

export async function deleteObjects(keys: string[]): Promise<{ deleted: string[], failed: string[] }> {
  if (!keys.length) return { deleted: [], failed: [] }
  const res = await s3().send(new DeleteObjectsCommand({
    Bucket: storageBucket(),
    Delete: { Objects: keys.map(Key => ({ Key })), Quiet: false },
  }))
  const failed = (res.Errors ?? []).map(e => e.Key).filter((k): k is string => !!k)
  return { deleted: keys.filter(k => !failed.includes(k)), failed }
}

export async function ensureBucket(bucket: string): Promise<void> {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket }))
  }
  catch {
    await s3().send(new CreateBucketCommand({ Bucket: bucket }))
  }
}

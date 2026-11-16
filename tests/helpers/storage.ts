import { CreateBucketCommand, HeadBucketCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'

export const TEST_S3 = {
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'takt-test',
  S3_ACCESS_KEY_ID: 'takt',
  S3_SECRET_ACCESS_KEY: 'takt-dev-secret',
}

const client = new S3Client({
  endpoint: TEST_S3.S3_ENDPOINT,
  region: TEST_S3.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: TEST_S3.S3_ACCESS_KEY_ID, secretAccessKey: TEST_S3.S3_SECRET_ACCESS_KEY },
})

export async function ensureTestBucket(): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: TEST_S3.S3_BUCKET }))
  }
  catch {
    await client.send(new CreateBucketCommand({ Bucket: TEST_S3.S3_BUCKET }))
  }
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: TEST_S3.S3_BUCKET, Key: key }))
    return true
  }
  catch {
    return false
  }
}

export async function uploadTo(url: string, body: string | Uint8Array, contentType: string): Promise<number> {
  const res = await fetch(url, { method: 'PUT', headers: { 'content-type': contentType }, body })
  return res.status
}

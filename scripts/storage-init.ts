import { ensureBucket } from '../server/utils/storage'

const endpoint = process.env.S3_ENDPOINT ?? ''
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(endpoint)) {
  console.error(`storage:init only runs against a local S3, got S3_ENDPOINT=${endpoint || '(empty)'}`)
  process.exit(1)
}

for (const bucket of ['takt-dev', 'takt-test']) {
  await ensureBucket(bucket)
  console.log('bucket ready:', bucket)
}

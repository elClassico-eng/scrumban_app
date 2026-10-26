import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { ALL_SCOPES, startFakePachca } from './helpers/fake-pachca'
import { TEST_URL } from './setup.global'

const APP = 'http://takt.test'
const fake = await startFakePachca()
process.env.PACHCA_API_BASE = fake.url
process.env.INTEGRATIONS_SECRET = Buffer.alloc(32, 7).toString('base64')
process.env.APP_URL = APP
process.env.FEED_SETTLE_MS = '0'
process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

const BOT_TOKEN = 'bot-token-0001'
const BOT_ID = 900

afterAll(async () => {
  await closeTestSql()
  await fake.close()
})

beforeEach(async () => {
  await resetDb()
  fake.reset()
  fake.state.tokens.set(BOT_TOKEN, { userId: BOT_ID, scopes: ALL_SCOPES })
})

describe('pachca client via fake', () => {
  it('fake answers token info for a known token', async () => {
    const res = await fetch(`${fake.url}/oauth/token/info`, { headers: { authorization: `Bearer ${BOT_TOKEN}` } })
    expect(res.status).toBe(200)
    expect((await res.json() as { data: { user_id: number } }).data.user_id).toBe(BOT_ID)
  })
})

import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { closeTestSql, resetDb } from './helpers/db'
import { CookieJar, fetchWithJar } from './helpers/http'
import { TEST_URL } from './setup.global'
import type { SprintNetworkReport } from '../shared/types/network'
import type { ScenarioSimulationReport } from '../shared/types/scenario'

process.env.DATABASE_URL = TEST_URL
await setup({ dev: true })

afterAll(async () => {
  await closeTestSql()
})

beforeEach(async () => {
  await resetDb()
})

async function registerUser(email: string): Promise<CookieJar> {
  const jar = new CookieJar()
  await fetchWithJar(jar, '/api/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'correct horse battery 1',
      workspace: { name: 'Reg WS', slug: 'reg-ws' },
    },
    headers: { 'x-forwarded-for': `10.3.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}` },
  })
  return jar
}

const EXCLUDABLE_TASK = '00000000-0000-4000-8000-000000000002'
const CHAIN_HEAD = '00000000-0000-4000-8000-000000000001'
const CHAIN_TAIL = '00000000-0000-4000-8000-000000000004'

describe('sandbox simulator', () => {
  it('401 без авторизации', async () => {
    const anon = new CookieJar()
    const net = await fetchWithJar(anon, '/api/sandbox/simulator/network')
    expect(net.status).toBe(401)
    const sim = await fetchWithJar(anon, '/api/sandbox/simulator/simulate', {
      method: 'POST',
      body: { changes: [{ type: 'shift_deadline', days: 2 }] },
    })
    expect(sim.status).toBe(401)
  })

  it('network отдаёт живой прогноз с критическим путём', async () => {
    const jar = await registerUser('sandbox@example.com')
    const res = await fetchWithJar<SprintNetworkReport>(jar, '/api/sandbox/simulator/network')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    if (res.body.ok) {
      expect(res.body.remainingCount).toBe(6)
      expect(res.body.edgeCount).toBe(5)
      expect(res.body.criticalPathIds.length).toBeGreaterThan(1)
      expect(res.body.simulation.probabilityWithinHorizon).toBeGreaterThan(0)
      expect(res.body.simulation.probabilityWithinHorizon).toBeLessThan(1)
    }
  })

  it('simulate считает дельту для exclude критической задачи', async () => {
    const jar = await registerUser('sandbox2@example.com')
    const res = await fetchWithJar<ScenarioSimulationReport>(jar, '/api/sandbox/simulator/simulate', {
      method: 'POST',
      body: { changes: [{ type: 'exclude_task', taskId: EXCLUDABLE_TASK }] },
    })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    if (res.body.ok) {
      expect(res.body.scenario.remainingCount).toBe(5)
      expect(res.body.delta.p50Days).toBeGreaterThan(0)
    }
  })

  it('цикл в зависимостях → 422', async () => {
    const jar = await registerUser('sandbox3@example.com')
    const res = await fetchWithJar(jar, '/api/sandbox/simulator/simulate', {
      method: 'POST',
      body: { changes: [{ type: 'add_dependency', blockerTaskId: CHAIN_TAIL, blockedTaskId: CHAIN_HEAD }] },
    })
    expect(res.status).toBe(422)
  })
})

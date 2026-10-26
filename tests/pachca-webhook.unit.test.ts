import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseTaktLink, verifyPachcaSignature } from '../server/utils/pachca/webhook'

const WS = '11111111-1111-4111-8111-111111111111'
const BOARD = '22222222-2222-4222-8222-222222222222'
const TASK = '33333333-3333-4333-8333-333333333333'
const APP = 'https://takt34.tech'

describe('verifyPachcaSignature', () => {
  const raw = JSON.stringify({ event: 'link_shared', webhook_timestamp: 1_000_000 })
  const sig = createHmac('sha256', 'secret').update(raw).digest('hex')

  it('accepts a fresh correctly signed body', () => {
    expect(verifyPachcaSignature(raw, sig, 'secret', 1_000_030)).toBe(true)
  })

  it('rejects a wrong secret, a missing header and a stale timestamp', () => {
    expect(verifyPachcaSignature(raw, sig, 'other', 1_000_030)).toBe(false)
    expect(verifyPachcaSignature(raw, undefined, 'secret', 1_000_030)).toBe(false)
    expect(verifyPachcaSignature(raw, sig, 'secret', 1_000_100)).toBe(false)
  })
})

describe('parseTaktLink', () => {
  it('parses task and board links', () => {
    expect(parseTaktLink(`${APP}/workspaces/${WS}/boards/${BOARD}?task=${TASK}`, APP)).toEqual({ workspaceId: WS, boardId: BOARD, taskId: TASK })
    expect(parseTaktLink(`${APP}/workspaces/${WS}/boards/${BOARD}/`, APP)).toEqual({ workspaceId: WS, boardId: BOARD, taskId: null })
  })

  it('ignores other hosts, other paths and garbage', () => {
    expect(parseTaktLink(`https://evil.example/workspaces/${WS}/boards/${BOARD}`, APP)).toBeNull()
    expect(parseTaktLink(`${APP}/workspaces/${WS}/members`, APP)).toBeNull()
    expect(parseTaktLink(`${APP}/workspaces/${WS}/boards/${BOARD}?task=nope`, APP)).toEqual({ workspaceId: WS, boardId: BOARD, taskId: null })
    expect(parseTaktLink('not a url', APP)).toBeNull()
  })
})

// Unit-level test for the in-process board event bus.
// (Full HTTP-SSE e2e is hard to drive reliably from Vitest because the
// connection is long-lived; we cover the wiring with this and rely on
// manual smoke-tests for the actual EventStream output.)
import { describe, expect, it } from 'vitest'
import {
  publishBoardEvent,
  subscribeBoardEvents,
  type BoardEvent,
} from '../server/utils/events'

describe('events.publishBoardEvent / subscribeBoardEvents', () => {
  it('delivers events to subscribers of the matching board', () => {
    const received: BoardEvent[] = []
    const unsubscribe = subscribeBoardEvents('board-A', (e) => received.push(e))

    publishBoardEvent({
      type: 'task.created',
      workspaceId: 'ws-1',
      boardId: 'board-A',
      payload: { id: 'task-1' },
    })

    expect(received).toHaveLength(1)
    expect(received[0]!.type).toBe('task.created')
    expect(received[0]!.ts).toMatch(/T.*Z$/) // ISO timestamp added by the helper
    unsubscribe()
  })

  it('does not deliver events meant for other boards', () => {
    const received: BoardEvent[] = []
    const unsubscribe = subscribeBoardEvents('board-X', (e) => received.push(e))

    publishBoardEvent({
      type: 'task.moved',
      workspaceId: 'ws-1',
      boardId: 'board-Y',
      payload: {},
    })

    expect(received).toHaveLength(0)
    unsubscribe()
  })

  it('unsubscribe removes the listener', () => {
    const received: BoardEvent[] = []
    const unsubscribe = subscribeBoardEvents('board-Z', (e) => received.push(e))
    unsubscribe()

    publishBoardEvent({
      type: 'task.deleted',
      workspaceId: 'ws-1',
      boardId: 'board-Z',
      payload: {},
    })

    expect(received).toHaveLength(0)
  })

  it('multiple subscribers each get the event', () => {
    const a: BoardEvent[] = []
    const b: BoardEvent[] = []
    const ua = subscribeBoardEvents('board-M', (e) => a.push(e))
    const ub = subscribeBoardEvents('board-M', (e) => b.push(e))

    publishBoardEvent({
      type: 'task.updated',
      workspaceId: 'ws-1',
      boardId: 'board-M',
      payload: { id: 'task-1' },
    })

    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    ua()
    ub()
  })
})

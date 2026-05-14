// In-process pub/sub for real-time board updates. Services call
// publishBoardEvent() AFTER a successful transaction; the SSE handler
// subscribes per board and forwards events to the connected client.
//
// Single-instance only: when we scale to 2+ Nitro replicas (Phase 4)
// publishBoardEvent() will additionally emit through pg LISTEN/NOTIFY
// so peers see each other's events. Until then this EventEmitter is
// the whole story.
import { EventEmitter } from 'node:events'

export type BoardEventType =
  | 'task.created'
  | 'task.moved'
  | 'task.updated'
  | 'task.deleted'
  | 'task.commented'
  | 'task.comment_deleted'

export interface BoardEvent {
  type: BoardEventType
  workspaceId: string
  boardId: string
  // Free-form payload — e.g. the task object, or {taskId, fromColumnId, ...}
  payload: unknown
  // ISO timestamp; lets late-joining clients reason about ordering.
  ts: string
}

const bus = new EventEmitter()
// SSE clients add a listener each; we expect a few hundred and don't want
// Node's "MaxListenersExceededWarning" noise in logs.
bus.setMaxListeners(0)

export function publishBoardEvent(event: Omit<BoardEvent, 'ts'>): void {
  const full: BoardEvent = { ...event, ts: new Date().toISOString() }
  bus.emit(channelFor(event.boardId), full)
}

export function subscribeBoardEvents(
  boardId: string,
  handler: (event: BoardEvent) => void,
): () => void {
  const channel = channelFor(boardId)
  bus.on(channel, handler)
  return () => bus.off(channel, handler)
}

function channelFor(boardId: string): string {
  return `board:${boardId}`
}

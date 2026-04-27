// GET /api/workspaces/:id/boards/:boardId/stream — Server-Sent Events
// for real-time board updates. The frontend opens an EventSource on
// this URL and receives JSON-encoded BoardEvent rows as they happen
// (task.created / task.moved / task.updated / task.deleted).
//
// The connection is held open until the client disconnects. Heartbeats
// (a comment line every 25 s) keep proxies and load balancers from
// idling the connection.
import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../utils/auth'
import { toHttpError } from '../../../../../utils/errors'
import { subscribeBoardEvents } from '../../../../../utils/events'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })

// Common reverse proxies (Caddy default) drop idle connections at 30s;
// 25s gives us comfortable headroom.
const HEARTBEAT_MS = 25_000

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    // Membership check before we open the long-lived stream.
    await getWorkspaceForUserOrThrow(id, user.id)

    const stream = createEventStream(event)

    const unsubscribe = subscribeBoardEvents(boardId, (boardEvent) => {
      stream.push({
        event: boardEvent.type,
        data: JSON.stringify(boardEvent),
      })
    })

    const heartbeat = setInterval(() => {
      // SSE comment line — clients ignore it but the bytes keep the TCP
      // connection alive through proxies.
      stream.push(': ping')
    }, HEARTBEAT_MS)

    // H3's stream lifecycle hook fires when the client disconnects OR the
    // server starts shutting down. Use it to detach our subscription so
    // we don't leak listeners.
    stream.onClosed(() => {
      clearInterval(heartbeat)
      unsubscribe()
    })

    return stream.send()
  } catch (err) {
    throw toHttpError(err)
  }
})

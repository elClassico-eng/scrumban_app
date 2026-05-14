import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'
import { subscribeUserEvents } from '../../utils/events'

const HEARTBEAT_MS = 25_000

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const stream = createEventStream(event)

    const unsubscribe = subscribeUserEvents(user.id, (userEvent) => {
      stream.push({
        event: userEvent.type,
        data: JSON.stringify(userEvent),
      })
    })

    const heartbeat = setInterval(() => {
      stream.push(': ping')
    }, HEARTBEAT_MS)

    stream.onClosed(() => {
      clearInterval(heartbeat)
      unsubscribe()
    })

    return stream.send()
  }
  catch (err) {
    throw toHttpError(err)
  }
})
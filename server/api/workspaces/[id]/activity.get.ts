import { z } from 'zod'
import { listActivityForWorkspace } from '../../../services/activity.service'
import { getWorkspaceForUserOrThrow } from '../../../services/workspaces.service'
import { requireAuth } from '../../../utils/auth'
import { toHttpError } from '../../../utils/errors'

const EVENT_TYPES = [
  'task_created',
  'task_moved',
  'task_closed',
  'task_reopened',
  'task_assigned',
  'task_updated',
  'task_archived',
  'task_commented',
  'task_comment_deleted',
] as const

const ParamsSchema = z.object({ id: z.uuid() })
const QuerySchema = z.object({
  board: z.uuid().optional(),
  actor: z.uuid().optional(),
  event: z.string().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const query = await getValidatedQuery(event, QuerySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const eventTypes = query.event
      ?.split(',')
      .map(s => s.trim())
      .filter((s): s is (typeof EVENT_TYPES)[number] => (EVENT_TYPES as readonly string[]).includes(s))

    const events = await listActivityForWorkspace({
      workspaceId: id,
      actorRole: workspace.role,
      filters: {
        boardId: query.board,
        actorId: query.actor,
        eventTypes: eventTypes && eventTypes.length > 0 ? eventTypes : undefined,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
    })
    return { events }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
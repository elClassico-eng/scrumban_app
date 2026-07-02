import { z } from 'zod'
import { requireAuth } from '../../../../utils/auth'
import { ForbiddenError, NotFoundError, toHttpError } from '../../../../utils/errors'
import { listWorkspacesForUser } from '../../../../services/workspaces.service'

const ALLOWED_TASKS = [
  'notifications:check-sle-breaches',
  'notifications:check-replenishment',
  'notifications:check-sprint-forecast',
  'forecast:daily-snapshots',
] as const

const ParamsSchema = z.object({ name: z.string().min(1) })

export default defineEventHandler(async (event) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenError('Dev-only endpoint')
    }

    const user = await requireAuth(event)
    const wsList = await listWorkspacesForUser(user.id)
    const anyAdmin = wsList.some(ws => ws.role === 'admin' || ws.role === 'owner')
    if (!anyAdmin) throw new ForbiddenError('Нужна роль admin или owner хотя бы в одном workspace')

    const { name } = await getValidatedRouterParams(event, ParamsSchema.parse)
    if (!(ALLOWED_TASKS as readonly string[]).includes(name)) {
      throw new NotFoundError('Неизвестный таск')
    }

    const result = await runTask(name)
    return { result }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
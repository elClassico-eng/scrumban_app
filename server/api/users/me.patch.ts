import { z } from 'zod'
import { updateUserProfile } from '../../services/users.service'
import { requireAuth } from '../../utils/auth'
import { toHttpError } from '../../utils/errors'

const BodySchema = z
  .object({
    firstName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(100).nullable().optional(),
    middleName: z.string().trim().max(100).nullable().optional(),
    avatarUrl: z.url().max(2000).nullable().optional(),
    jobTitle: z.string().trim().max(150).nullable().optional(),
    bio: z.string().max(5000).nullable().optional(),
  })
  .refine(d => Object.keys(d).length > 0, {
    message: 'Provide at least one field to update',
  })

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const body = await readValidatedBody(event, BodySchema.parse)

    const user = await updateUserProfile({
      userId: sessionUser.id,
      patch: body,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        bio: user.bio,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})

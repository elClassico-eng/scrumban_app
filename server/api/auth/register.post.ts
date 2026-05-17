// POST /api/auth/register — atomically creates user + first workspace +
// owner-membership in one DB transaction, then starts a session. Failure
// anywhere rolls everything back so no orphan users are left behind.
// Verification email is best-effort after commit.
import { z } from 'zod'
import { passwordSchema } from '#shared/validation/password'
import { createUserInTx } from '../../services/users.service'
import { createWorkspaceInTx } from '../../services/workspaces.service'
import { createVerification } from '../../services/email-verifications.service'
import { sendVerificationEmail } from '../../utils/auth-emails'
import { toHttpError } from '../../utils/errors'

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

const RegisterSchema = z.object({
  email: z.email().max(255),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  middleName: z.string().trim().max(100).optional(),
  workspace: z.object({
    name: z.string().trim().min(1).max(255),
    slug: z.string().trim().toLowerCase().min(3).max(64).regex(SLUG_RE, {
      message: 'slug must be lowercase letters, digits, and hyphens',
    }),
    description: z.string().trim().max(2000).optional(),
    purpose: z.string().trim().max(2000).optional(),
    industry: z.string().trim().max(100).optional(),
  }),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, RegisterSchema.parse)

  try {
    const passwordHash = await hashPassword(body.password)

    const { user, workspace } = await useDB().transaction(async (tx) => {
      const created = await createUserInTx(tx, {
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        middleName: body.middleName,
      })
      const ws = await createWorkspaceInTx(tx, {
        name: body.workspace.name,
        slug: body.workspace.slug,
        ownerId: created.id,
        description: body.workspace.description,
        purpose: body.workspace.purpose,
        industry: body.workspace.industry,
      })
      return { user: created, workspace: ws }
    })

    await setUserSession(event, { user: { id: user.id, email: user.email } })

    try {
      const { plainToken } = await createVerification(user.id)
      await sendVerificationEmail({
        to: user.email,
        recipientName: user.firstName ?? '',
        token: plainToken,
      })
    }
    catch (mailErr) {
      console.error('[register] failed to send verification email:', mailErr)
    }

    return {
      user: { id: user.id, email: user.email },
      workspace: { id: workspace.id, slug: workspace.slug },
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})

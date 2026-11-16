// POST /api/auth/register — atomically creates the user (and, when the
// caller sends one, a first workspace with owner-membership) in one DB
// transaction, then starts a session. Failure
// anywhere rolls everything back so no orphan users are left behind.
// Verification email is best-effort after commit.
import { createSession } from '../../services/user-sessions.service'
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
  consent: z.literal(true).optional(),
  workspace: z.object({
    name: z.string().trim().min(1).max(255),
    slug: z.string().trim().toLowerCase().min(3).max(64).regex(SLUG_RE, {
      message: 'slug must be lowercase letters, digits, and hyphens',
    }),
    description: z.string().trim().max(2000).optional(),
    purpose: z.string().trim().max(2000).optional(),
    industry: z.string().trim().max(100).optional(),
  }).optional(),
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
        personalDataConsentAt: body.consent ? new Date() : null,
      })
      const ws = body.workspace
        ? await createWorkspaceInTx(tx, {
            name: body.workspace.name,
            slug: body.workspace.slug,
            ownerId: created.id,
            description: body.workspace.description,
            purpose: body.workspace.purpose,
            industry: body.workspace.industry,
          })
        : null
      return { user: created, workspace: ws }
    })

    const sessionId = await createSession(event, user.id)
    await setUserSession(event, { user: { id: user.id, email: user.email }, sessionId })

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
      workspace: workspace ? { id: workspace.id, slug: workspace.slug } : null,
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})

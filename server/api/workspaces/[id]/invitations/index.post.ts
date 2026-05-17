import { z } from 'zod'
import { getWorkspaceForUserOrThrow } from '../../../../services/workspaces.service'
import { findUserById } from '../../../../services/users.service'
import { createInvitation } from '../../../../services/workspace-invitations.service'
import { requireAuth } from '../../../../utils/auth'
import { sendWorkspaceInvitationEmail } from '../../../../utils/auth-emails'
import { toHttpError } from '../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid() })
const BodySchema = z.object({
  role: z.enum(['viewer', 'member', 'scrum_master', 'admin', 'owner']),
  email: z.union([z.email().max(255), z.literal('')]).optional(),
})

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Viewer',
  member: 'Member',
  scrum_master: 'Scrum Master',
  admin: 'Admin',
  owner: 'Owner',
}

export default defineEventHandler(async (event) => {
  try {
    const sessionUser = await requireAuth(event)
    const { id } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)

    const workspace = await getWorkspaceForUserOrThrow(id, sessionUser.id)
    const inviter = await findUserById(sessionUser.id)

    const email = body.email && body.email.length > 0 ? body.email : null

    const { invitation, plainToken } = await createInvitation({
      workspaceId: id,
      role: body.role,
      email,
      createdBy: sessionUser.id,
      actorRole: workspace.role,
    })

    if (email) {
      try {
        const inviterName = inviter
          ? [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') || inviter.email
          : ''
        await sendWorkspaceInvitationEmail({
          to: email,
          workspaceName: workspace.name,
          inviterName,
          role: ROLE_LABELS[body.role] ?? body.role,
          token: plainToken,
        })
      }
      catch (mailErr) {
        console.error('[invitations] failed to send invitation email:', mailErr)
      }
    }

    return {
      invitation: {
        id: invitation.id,
        role: invitation.role,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
      token: plainToken,
    }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
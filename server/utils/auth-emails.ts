import { sendEmail } from './email'
import {
  emailVerificationTemplate,
  passwordResetTemplate,
  workspaceInvitationTemplate,
} from './email-templates'

function getAppUrl(): string {
  const raw = process.env.APP_URL ?? 'http://localhost:3000'
  return raw.replace(/\/+$/, '')
}

export async function sendVerificationEmail(opts: {
  to: string
  recipientName: string
  token: string
}): Promise<void> {
  const verifyUrl = `${getAppUrl()}/verify-email/${opts.token}`
  const { subject, html, text } = emailVerificationTemplate({
    recipientName: opts.recipientName,
    verifyUrl,
  })
  await sendEmail({ to: opts.to, subject, html, text })
}

export async function sendPasswordResetEmail(opts: {
  to: string
  recipientName: string
  token: string
}): Promise<void> {
  const resetUrl = `${getAppUrl()}/reset-password/${opts.token}`
  const { subject, html, text } = passwordResetTemplate({
    recipientName: opts.recipientName,
    resetUrl,
  })
  await sendEmail({ to: opts.to, subject, html, text })
}

export async function sendWorkspaceInvitationEmail(opts: {
  to: string
  workspaceName: string
  inviterName: string
  role: string
  token: string
}): Promise<void> {
  const acceptUrl = `${getAppUrl()}/invite/${opts.token}`
  const { subject, html, text } = workspaceInvitationTemplate({
    workspaceName: opts.workspaceName,
    inviterName: opts.inviterName,
    role: opts.role,
    acceptUrl,
  })
  await sendEmail({ to: opts.to, subject, html, text })
}

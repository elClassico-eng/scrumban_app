import { sendEmail } from './email'
import { emailVerificationTemplate } from './email-templates'

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

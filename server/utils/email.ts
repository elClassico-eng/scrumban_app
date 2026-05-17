import nodemailer, { type Transporter } from 'nodemailer'

let cachedTransporter: Transporter | null = null

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter
  const host = process.env.SMTP_HOST
  if (!host) {
    throw new Error('SMTP_HOST is not set. Configure email transport in .env.')
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
      : undefined,
  })
  return cachedTransporter
}

export type SendEmailOptions = {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'Scrumban <noreply@scrumban-thesis.ru>'
  await getTransporter().sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text ?? stripHtml(options.html),
  })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

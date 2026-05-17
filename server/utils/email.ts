import nodemailer, { type Transporter } from 'nodemailer'

function buildTransporter(): Transporter {
  const host = process.env.SMTP_HOST
  if (!host) {
    throw new Error('SMTP_HOST is not set. Configure email transport in .env.')
  }
  const port = Number(process.env.SMTP_PORT ?? 1025)
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS ?? ''
  const isLocalDev = host === 'localhost' || host === '127.0.0.1'

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    ignoreTLS: isLocalDev,
    name: isLocalDev ? 'localhost' : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
  })
}

export type SendEmailOptions = {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'Scrumban <noreply@scrumban-thesis.ru>'
  const transporter = buildTransporter()
  try {
    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text ?? stripHtml(options.html),
    })
  }
  finally {
    transporter.close()
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

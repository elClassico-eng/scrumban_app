import nodemailer, { type Transporter } from 'nodemailer'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

export type SendEmailOptions = {
  to: string
  subject: string
  html: string
  text?: string
}

let sesClient: SESv2Client | null = null

function getSESClient(): SESv2Client {
  if (sesClient) return sesClient
  const accessKeyId = process.env.SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY are not set')
  }
  sesClient = new SESv2Client({
    region: process.env.SES_REGION ?? 'ru-central1',
    endpoint: process.env.SES_ENDPOINT ?? 'https://postbox.cloud.yandex.net',
    credentials: { accessKeyId, secretAccessKey },
  })
  return sesClient
}

async function sendViaSES(options: SendEmailOptions, from: string): Promise<void> {
  await getSESClient().send(new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: [options.to] },
    Content: {
      Simple: {
        Subject: { Data: options.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: options.html, Charset: 'UTF-8' },
          Text: { Data: options.text ?? stripHtml(options.html), Charset: 'UTF-8' },
        },
      },
    },
  }))
}

function buildSMTPTransporter(): Transporter {
  const host = process.env.SMTP_HOST
  if (!host) {
    throw new Error('SMTP_HOST is not set and SES credentials are missing — configure one transport in .env')
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

async function sendViaSMTP(options: SendEmailOptions, from: string): Promise<void> {
  const transporter = buildSMTPTransporter()
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

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'Scrumban <noreply@takt34.tech>'
  if (process.env.SES_ACCESS_KEY_ID) {
    return sendViaSES(options, from)
  }
  return sendViaSMTP(options, from)
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

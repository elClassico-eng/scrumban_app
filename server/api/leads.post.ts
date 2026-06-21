import { z } from 'zod'
import { createLead } from '../services/leads.service'
import { sendEmail } from '../utils/email'
import { toHttpError } from '../utils/errors'

const LeadSchema = z.object({
  email: z.email().max(255),
  team: z.string().max(200).optional(),
  intents: z.array(z.enum(['try', 'partner', 'follow'])).max(3).default([]),
  company: z.string().optional(),
  consent: z.literal(true),
})

const INTENT_LABEL: Record<string, string> = {
  try: 'Хочу попробовать',
  partner: 'Обсудить сотрудничество',
  follow: 'Просто следить',
}

function esc(s: string): string {
  return s.replace(/[<>&]/g, c => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'))
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, LeadSchema.parse)
    if (body.company && body.company.trim()) return { ok: true }

    const team = body.team?.trim() || null
    await createLead({ email: body.email, team, intents: body.intents.join(',') })

    const notifyTo = process.env.LEADS_NOTIFY_EMAIL
    if (notifyTo) {
      const intentText = body.intents.map(i => INTENT_LABEL[i] ?? i).join(', ') || '—'
      try {
        await sendEmail({
          to: notifyTo,
          subject: `ScrumBan — новая заявка: ${body.email}`,
          html: `<p><b>Email:</b> ${esc(body.email)}</p>`
            + `<p><b>Команда / роль:</b> ${esc(team ?? '—')}</p>`
            + `<p><b>Интерес:</b> ${esc(intentText)}</p>`,
        })
      }
      catch (mailErr) {
        console.error('[leads] notify email failed:', mailErr)
      }
    }

    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})

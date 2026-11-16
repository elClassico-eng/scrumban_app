import { z } from 'zod'
import { createLead } from '../services/leads.service'
import { sendEmail } from '../utils/email'
import { toHttpError } from '../utils/errors'

const LeadSchema = z.object({
  email: z.email().max(255),
  teamSize: z.string().trim().max(50).optional(),
  currentTool: z.string().trim().max(200).optional(),
  company: z.string().optional(),
  consent: z.literal(true),
})

function esc(s: string): string {
  return s.replace(/[<>&]/g, c => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'))
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, LeadSchema.parse)
    if (body.company && body.company.trim()) return { ok: true }

    const teamSize = body.teamSize || null
    const currentTool = body.currentTool || null
    await createLead({ email: body.email, teamSize, currentTool, consentAt: new Date() })

    const notifyTo = process.env.LEADS_NOTIFY_EMAIL
    if (notifyTo) {
      try {
        await sendEmail({
          to: notifyTo,
          subject: `Такт – заявка на пилот: ${body.email}`,
          html: `<p><b>Email:</b> ${esc(body.email)}</p>`
            + `<p><b>Размер команды:</b> ${esc(teamSize ?? '–')}</p>`
            + `<p><b>Чем пользуются:</b> ${esc(currentTool ?? '–')}</p>`,
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

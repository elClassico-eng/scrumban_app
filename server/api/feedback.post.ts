import { z } from 'zod'
import { createFeedback } from '../services/feedback.service'
import { requireAuth } from '../utils/auth'
import { sendEmail } from '../utils/email'
import { toHttpError } from '../utils/errors'

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(v => v || undefined)

const FeedbackSchema = z.object({
  liked: optionalText(5000),
  disliked: optionalText(5000),
  missing: optionalText(5000),
  rating: z.number().int().min(1).max(5).optional(),
  email: z.preprocess(v => (typeof v === 'string' && !v.trim() ? undefined : v), z.email().max(255).optional()),
  team: optionalText(200),
  wantsReply: z.boolean().optional().default(false),
  consent: z.literal(true).optional(),
  company: z.string().optional(),
}).superRefine((d, ctx) => {
  if (!d.liked && !d.disliked && !d.missing) {
    ctx.addIssue({ code: 'custom', message: 'Заполните хотя бы одно поле отзыва', path: ['liked'] })
  }
  if (d.wantsReply && !d.email) {
    ctx.addIssue({ code: 'custom', message: 'Укажите email, чтобы получить ответ', path: ['email'] })
  }
  if ((d.email || d.team) && !d.consent) {
    ctx.addIssue({ code: 'custom', message: 'Подтвердите согласие на обработку персональных данных', path: ['consent'] })
  }
})

function esc(s: string): string {
  return s.replace(/[<>&]/g, c => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'))
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, FeedbackSchema.parse)
    if (body.company && body.company.trim()) return { ok: true }

    const user = await requireAuth(event).catch(() => null)
    const row = await createFeedback({
      liked: body.liked ?? null,
      disliked: body.disliked ?? null,
      missing: body.missing ?? null,
      rating: body.rating ?? null,
      email: body.email ?? null,
      team: body.team ?? null,
      wantsReply: body.wantsReply,
      userId: user?.id ?? null,
      consentAt: body.consent ? new Date() : null,
    })

    const notifyTo = process.env.LEADS_NOTIFY_EMAIL
    if (notifyTo) {
      try {
        const line = (label: string, v: string | number | null) => `<p><b>${label}:</b> ${esc(String(v ?? '–'))}</p>`
        await sendEmail({
          to: notifyTo,
          subject: `Такт – новый отзыв${row.rating ? ` (${row.rating}/5)` : ''}`,
          html: line('Нравится', row.liked) + line('Мешает', row.disliked) + line('Не хватает', row.missing)
            + line('Оценка', row.rating) + line('Email', row.email) + line('Команда', row.team)
            + line('Хочет ответ', row.wantsReply ? 'да' : 'нет'),
        })
      }
      catch (mailErr) {
        console.error('[feedback] notify email failed:', mailErr)
      }
    }

    return { ok: true }
  }
  catch (err) {
    throw toHttpError(err)
  }
})

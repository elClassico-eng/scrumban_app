import { sendDailyDigests, sendPachcaDigests } from '../../services/digest.service'

export default defineTask({
  meta: {
    name: 'notifications:daily-digest',
    description: 'Send the morning digest by email and to linked Pachca accounts',
  },
  async run({ payload }) {
    const now = typeof payload?.now === 'string' ? new Date(payload.now) : new Date()
    const pachcaResult = await sendPachcaDigests(now)
    const email = await sendDailyDigests(now)
    return { result: 'success', ...email, pachca: pachcaResult.sent }
  },
})

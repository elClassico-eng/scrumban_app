import { sendDailyDigests, sendPachcaDigests } from '../../services/digest.service'

export default defineTask({
  meta: {
    name: 'notifications:daily-digest',
    description: 'Send the morning digest by email and to linked Pachca accounts',
  },
  async run() {
    const pachcaResult = await sendPachcaDigests()
    const email = await sendDailyDigests()
    return { result: 'success', ...email, pachca: pachcaResult.sent }
  },
})

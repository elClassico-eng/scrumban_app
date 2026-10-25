import { sendDailyDigests } from '../../services/digest.service'

export default defineTask({
  meta: {
    name: 'notifications:daily-digest',
    description: 'Send the morning email digest to everyone who has it on',
  },
  async run() {
    const result = await sendDailyDigests()
    return { result: 'success', ...result }
  },
})

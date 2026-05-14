import { checkSleBreaches } from '../../services/flow-alerts.service'

export default defineTask({
  meta: {
    name: 'notifications:check-sle-breaches',
    description: 'Emit sle_breach notifications for tasks aged past 85% of board SLE',
  },
  async run() {
    const result = await checkSleBreaches()
    return { result: 'success', ...result }
  },
})
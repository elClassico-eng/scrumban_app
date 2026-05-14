import { checkReplenishment } from '../../services/flow-alerts.service'

export default defineTask({
  meta: {
    name: 'notifications:check-replenishment',
    description: 'Emit replenishment_overdue notifications when a boards replenishment cycle is past due',
  },
  async run() {
    const result = await checkReplenishment()
    return { result: 'success', ...result }
  },
})
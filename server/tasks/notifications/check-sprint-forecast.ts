import { checkSprintForecast } from '../../services/flow-alerts.service'

export default defineTask({
  meta: {
    name: 'notifications:check-sprint-forecast',
    description: 'Emit sprint_forecast_drop when Monte Carlo probability of finishing on time falls below 70%',
  },
  async run() {
    const result = await checkSprintForecast()
    return { result: 'success', ...result }
  },
})

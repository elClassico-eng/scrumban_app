import { runDailyForecastSnapshots } from '../../services/forecast-snapshots.service'

export default defineTask({
  meta: {
    name: 'forecast:daily-snapshots',
    description: 'Take a daily forecast snapshot for every active sprint',
  },
  async run() {
    const result = await runDailyForecastSnapshots()
    return { result: 'success', ...result }
  },
})

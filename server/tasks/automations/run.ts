import { runAll } from '../../services/automations.service'

export default defineTask({
  meta: {
    name: 'automations:run',
    description: 'Evaluate automation rules on every board',
  },
  async run() {
    const result = await runAll()
    return { result: 'success', ...result }
  },
})

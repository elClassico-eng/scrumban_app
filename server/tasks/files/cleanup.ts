import { cleanupStaleUploads } from '../../services/files-maintenance.service'

export default defineTask({
  meta: {
    name: 'files:cleanup',
    description: 'Remove abandoned pending uploads and unsent comment files',
  },
  async run() {
    const result = await cleanupStaleUploads()
    return { result: 'success', ...result }
  },
})

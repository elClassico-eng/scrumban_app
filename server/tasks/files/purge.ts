import { purgeTrash } from '../../services/files-maintenance.service'

export default defineTask({
  meta: {
    name: 'files:purge',
    description: 'Delete objects that sat in the storage trash for 7 days',
  },
  async run() {
    const result = await purgeTrash()
    return { result: 'success', ...result }
  },
})

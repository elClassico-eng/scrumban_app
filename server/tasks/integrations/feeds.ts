import { runFeeds } from '../../services/board-feeds.service'

export default defineTask({
  meta: {
    name: 'integrations:feeds',
    description: 'Post new board events and standup summaries to Pachca chats',
  },
  async run() {
    const result = await runFeeds()
    return { result: 'success', ...result }
  },
})

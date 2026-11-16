export function formatMentionToken(name: string, userId: string): string {
  return `@[${name}](${userId})`
}

export function deserializeMentions(body: string): { text: string, mentions: Record<string, string> } {
  const mentions: Record<string, string> = {}
  const re = new RegExp(/@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi)
  const text = body.replace(re, (_, name: string, uuid: string) => {
    mentions[name] = uuid.toLowerCase()
    return `@${name}`
  })
  return { text, mentions }
}

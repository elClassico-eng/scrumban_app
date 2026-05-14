const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi

export type MentionSegment =
  | { type: 'text', value: string }
  | { type: 'mention', name: string, userId: string }

export function parseMentionSegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = []
  let lastIndex = 0
  for (const match of body.matchAll(MENTION_RE)) {
    const start = match.index!
    if (start > lastIndex) {
      segments.push({ type: 'text', value: body.slice(lastIndex, start) })
    }
    segments.push({
      type: 'mention',
      name: match[1]!,
      userId: match[2]!.toLowerCase(),
    })
    lastIndex = start + match[0].length
  }
  if (lastIndex < body.length) {
    segments.push({ type: 'text', value: body.slice(lastIndex) })
  }
  return segments
}

export function formatMentionToken(name: string, userId: string): string {
  return `@[${name}](${userId})`
}

export function serializeMentions(visible: string, mentions: Record<string, string>): string {
  const names = Object.keys(mentions).sort((a, b) => b.length - a.length)
  let out = visible
  for (const name of names) {
    const userId = mentions[name]!
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`@${escaped}`, 'g'), formatMentionToken(name, userId))
  }
  return out
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
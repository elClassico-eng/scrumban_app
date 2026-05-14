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
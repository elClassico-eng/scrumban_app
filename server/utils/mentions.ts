const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi

export function extractMentionedUserIds(body: string): string[] {
  const ids = new Set<string>()
  for (const match of body.matchAll(MENTION_RE)) {
    ids.add(match[2]!.toLowerCase())
  }
  return Array.from(ids)
}
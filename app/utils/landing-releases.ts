export type ReleaseEntry = { title: string, date: string, version?: string, summary?: string, path: string }

export function recentReleases(entries: ReleaseEntry[], limit = 4): ReleaseEntry[] {
  return entries
    .filter(e => !!e.version)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

export function latestRelease(entries: ReleaseEntry[]): ReleaseEntry | null {
  return recentReleases(entries, 1)[0] ?? null
}

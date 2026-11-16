import { describe, expect, it } from 'vitest'
import { latestRelease, recentReleases, type ReleaseEntry } from './landing-releases'

const entries: ReleaseEntry[] = [
  { title: 'Настройки', date: '2026-08-01', path: '/a' },
  { title: 'Релиз 0.3', date: '2026-10-14', version: '0.3', path: '/b' },
  { title: 'Релиз 0.4', date: '2026-10-25', version: '0.4', path: '/c' },
]

describe('latestRelease', () => {
  it('picks the newest entry that has a version', () => {
    expect(latestRelease(entries)?.version).toBe('0.4')
  })

  it('returns null when no entry is a release', () => {
    expect(latestRelease([entries[0]!])).toBeNull()
  })
})

describe('recentReleases', () => {
  it('keeps only versioned entries, newest first', () => {
    expect(recentReleases(entries).map(r => r.version)).toEqual(['0.4', '0.3'])
  })

  it('respects the limit', () => {
    expect(recentReleases(entries, 1)).toHaveLength(1)
  })
})

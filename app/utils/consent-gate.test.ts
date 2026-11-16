import { describe, expect, it } from 'vitest'
import { needsConsentGate } from './consent-gate'

describe('needsConsentGate', () => {
  it('gates a signed-in user without consent on an app page', () => {
    expect(needsConsentGate({ personalDataConsentAt: null }, '/workspaces')).toBe(true)
  })

  it('lets through a user who already consented', () => {
    expect(needsConsentGate({ personalDataConsentAt: '2026-11-09T10:00:00Z' }, '/workspaces')).toBe(false)
  })

  it('ignores guests', () => {
    expect(needsConsentGate(null, '/workspaces')).toBe(false)
    expect(needsConsentGate(undefined, '/workspaces')).toBe(false)
  })

  it('never covers public pages, so the documents stay readable before consent', () => {
    for (const path of ['/privacy', '/consent', '/terms', '/feedback', '/docs/math', '/invite/abc', '/verify-email/x']) {
      expect(needsConsentGate({ personalDataConsentAt: null }, path)).toBe(false)
    }
  })
})

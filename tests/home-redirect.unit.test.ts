import { describe, expect, it } from 'vitest'
import { homeRedirect } from '~/utils/home-redirect'

describe('homeRedirect', () => {
  it('sends a returning user to the path they left', () => {
    expect(homeRedirect({ authenticated: true, about: false, lastPath: '/workspaces/w/boards/b' })).toBe('/workspaces/w/boards/b')
  })
  it('falls back to the workspaces list without a saved path', () => {
    expect(homeRedirect({ authenticated: true, about: false, lastPath: null })).toBe('/workspaces')
  })
  it('keeps the landing when ?about is set', () => {
    expect(homeRedirect({ authenticated: true, about: true, lastPath: '/workspaces/w' })).toBeNull()
  })
  it('keeps the landing for guests', () => {
    expect(homeRedirect({ authenticated: false, about: false, lastPath: '/workspaces/w' })).toBeNull()
  })
})

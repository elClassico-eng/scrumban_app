import { describe, expect, it } from 'vitest'
import { pachcaSetupSteps } from '#shared/utils/pachca-setup'

const none = { connected: false, linked: false, feeds: 0, linkedMembers: 0, members: 3, linkPreviews: false }

describe('pachcaSetupSteps', () => {
  it('starts at connecting the bot', () => {
    expect(pachcaSetupSteps(none)).toMatchObject({ done: 0, total: 5, next: 'connect' })
  })

  it('points at inviting the team after the first feed', () => {
    expect(pachcaSetupSteps({ ...none, connected: true, linked: true, feeds: 1, linkedMembers: 1 })).toMatchObject({ done: 3, total: 5, next: 'invite' })
  })

  it('counts the team as invited once a second person links', () => {
    expect(pachcaSetupSteps({ ...none, connected: true, linked: true, feeds: 1, linkedMembers: 2 }).next).toBe('previews')
  })

  it('reports each step', () => {
    expect(pachcaSetupSteps({ ...none, connected: true }).status).toEqual({ connect: true, link: false, feed: false, invite: false, previews: false })
  })

  it('a solo workspace does not wait for invites', () => {
    expect(pachcaSetupSteps({ ...none, connected: true, linked: true, feeds: 1, linkedMembers: 1, members: 1, linkPreviews: true })).toMatchObject({ done: 5, total: 5, next: null })
  })
})

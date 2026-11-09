import { describe, expect, it } from 'vitest'
import { legacySettingsPath, visibleWorkspaceSections } from './settings-routes'

describe('legacySettingsPath maps old ?tab= links to the tree', () => {
  it('personal tabs keep their section', () => {
    expect(legacySettingsPath(undefined, 'w1')).toBe('/settings/profile')
    expect(legacySettingsPath('security', 'w1')).toBe('/settings/security')
    expect(legacySettingsPath('notifications', 'w1')).toBe('/settings/notifications')
    expect(legacySettingsPath('danger', 'w1')).toBe('/settings/account')
  })

  it('team tabs open the current workspace', () => {
    expect(legacySettingsPath('team', 'w1')).toBe('/settings/workspaces/w1/general')
    expect(legacySettingsPath('integrations', 'w1')).toBe('/settings/workspaces/w1/integrations')
  })

  it('falls back to the profile without a workspace or for unknown tabs', () => {
    expect(legacySettingsPath('team', null)).toBe('/settings/profile')
    expect(legacySettingsPath('bogus', 'w1')).toBe('/settings/profile')
  })
})

describe('visibleWorkspaceSections follows the role', () => {
  it('hides boards below scrum master and deletion below owner', () => {
    expect(visibleWorkspaceSections('viewer')).toEqual(['general', 'storage', 'integrations'])
    expect(visibleWorkspaceSections('scrum_master')).toEqual(['general', 'storage', 'integrations', 'boards'])
    expect(visibleWorkspaceSections('admin')).toEqual(['general', 'storage', 'integrations', 'boards'])
    expect(visibleWorkspaceSections('owner')).toEqual(['general', 'storage', 'integrations', 'boards', 'delete'])
  })
})

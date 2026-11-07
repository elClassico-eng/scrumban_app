import { pageRoutes } from '~/routing'

export const LAST_PATH_KEY = 'scrumban:last-path'

export function homeRedirect(input: { authenticated: boolean, about: boolean, lastPath: string | null }): string | null {
  if (!input.authenticated || input.about) return null
  return input.lastPath ?? pageRoutes.workspaces
}

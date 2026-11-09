import { pageRoutes } from '~/routing'

export const LAST_PATH_KEY = 'scrumban:last-path'
export const START_PAGE_KEY = 'scrumban:start-page'

export function homeRedirect(input: { authenticated: boolean, about: boolean, lastPath: string | null, startPage: string | null }): string | null {
  if (!input.authenticated || input.about) return null
  return input.startPage ?? input.lastPath ?? pageRoutes.workspaces
}

import { isPublicPath } from '~/utils/public-routes'

export function needsConsentGate(
  user: { personalDataConsentAt: string | null } | null | undefined,
  path: string,
): boolean {
  return !!user && !user.personalDataConsentAt && !isPublicPath(path)
}

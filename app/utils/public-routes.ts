import { pageRoutes } from '~/routing'

export const AUTH_ROUTES: ReadonlyArray<string> = [
  pageRoutes.login,
  pageRoutes.register,
  pageRoutes.forgotPassword,
]

// Reachable by guests and signed-in users alike: unlike AUTH_ROUTES,
// signed-in users are not bounced away from these.
const PUBLIC_ROUTES: ReadonlyArray<string> = [
  pageRoutes.privacy,
  pageRoutes.consent,
  pageRoutes.terms,
  pageRoutes.feedback,
]

const PUBLIC_PREFIXES: ReadonlyArray<string> = [
  '/verify-email/',
  '/reset-password/',
  '/invite/',
  '/docs',
]

export function isPublicPath(path: string): boolean {
  return AUTH_ROUTES.includes(path)
    || PUBLIC_ROUTES.includes(path)
    || PUBLIC_PREFIXES.some(p => path.startsWith(p))
}

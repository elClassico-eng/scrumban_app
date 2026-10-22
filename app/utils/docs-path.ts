// public/docs holds static diagrams, so the static server redirects /docs to /docs/;
// content paths never end with a slash.
export function docsContentPath(path: string): string {
  return path.replace(/\/+$/, '') || '/'
}

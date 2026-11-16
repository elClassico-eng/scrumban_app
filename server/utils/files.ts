export type FileKind = 'attachment' | 'user_avatar' | 'workspace_logo' | 'board_image'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
const MB = 1_048_576

export const FILE_LIMITS: Record<FileKind, { maxBytes: number, types: string[] | null }> = {
  attachment: { maxBytes: 25 * MB, types: null },
  user_avatar: { maxBytes: 5 * MB, types: IMAGE_TYPES },
  workspace_logo: { maxBytes: 5 * MB, types: IMAGE_TYPES },
  board_image: { maxBytes: 5 * MB, types: IMAGE_TYPES },
}
export const THUMB_MAX_BYTES = MB
export const THUMB_TYPE = 'image/webp'
export const IMAGE_WINDOW_SEC = 86_400
export const ATTACHMENT_WINDOW_SEC = 3_600
const DEFAULT_QUOTA = 2 * 1024 * MB

export function quotaBytes(): number {
  const raw = Number(process.env.FILES_QUOTA_BYTES)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_QUOTA
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  const clean = [...base].filter(c => c.charCodeAt(0) > 31 && c.charCodeAt(0) !== 127).join('').trim()
  if (!clean) return 'file'
  if (clean.length <= 255) return clean
  const dot = clean.lastIndexOf('.')
  const ext = dot > 0 && clean.length - dot <= 16 ? clean.slice(dot) : ''
  return clean.slice(0, 255 - ext.length) + ext
}

export function dispositionFor(contentType: string, download: boolean): 'inline' | 'attachment' {
  return !download && INLINE_TYPES.has(contentType) ? 'inline' : 'attachment'
}

export function contentDisposition(disposition: 'inline' | 'attachment', fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  const ext = dot > 0 ? fileName.slice(dot).replace(/[^\w.]/g, '') : ''
  return `${disposition}; filename="file${ext}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export function storageKeyFor(input: { fileId: string, workspaceId: string | null, userId: string | null }): string {
  return input.workspaceId ? `ws/${input.workspaceId}/${input.fileId}` : `users/${input.userId}/${input.fileId}`
}

export function fileUrl(input: { id: string, workspaceId: string | null }, opts: { thumb?: boolean, download?: boolean } = {}): string {
  const base = input.workspaceId ? `/api/files/w/${input.workspaceId}/${input.id}` : `/api/files/u/${input.id}`
  const qs = [opts.thumb ? 'thumb=1' : null, opts.download ? 'download=1' : null].filter(Boolean).join('&')
  return qs ? `${base}?${qs}` : base
}

export type FileKind = 'attachment' | 'user_avatar' | 'workspace_logo' | 'board_image' | 'user_background'

export type FileView = {
  id: string
  kind: FileKind
  name: string
  contentType: string
  sizeBytes: number
  width: number | null
  height: number | null
  url: string
  thumbUrl: string | null
  downloadUrl: string
  commentId: string | null
  uploadedBy: { id: string, name: string } | null
  createdAt: string
  canDelete: boolean
}

export type UploadTicket = {
  file: FileView
  uploadUrl: string
  thumbUploadUrl: string | null
}

export type QuotaFileKind = 'attachment' | 'board_image' | 'workspace_logo'

export type StorageUsage = {
  usedBytes: number
  limitBytes: number
  byKind: Partial<Record<QuotaFileKind, number>>
}

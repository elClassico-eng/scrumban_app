import type { FileKind } from '#shared/types/files'

const FACE_SIDE = 256
const BACKGROUND_SIDE = 2560

export function uploadImagePlan(kind: FileKind): { maxSide: number, square: boolean } | null {
  if (kind === 'attachment') return null
  if (kind === 'user_background') return { maxSide: BACKGROUND_SIDE, square: false }
  return { maxSide: FACE_SIDE, square: true }
}

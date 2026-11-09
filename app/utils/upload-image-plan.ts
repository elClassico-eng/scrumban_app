import type { FileKind } from '#shared/types/files'

const FACE_SIDE = 256

export function uploadImagePlan(kind: FileKind): { maxSide: number, square: boolean } | null {
  return kind === 'attachment' ? null : { maxSide: FACE_SIDE, square: true }
}

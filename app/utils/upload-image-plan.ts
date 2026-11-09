import type { FileKind } from '#shared/types/files'

const FACE_SIDE = 256
const BACKGROUND_MAX_BYTES = 10 * 1_048_576
const BACKGROUND_SIDE = 3840

export function uploadImagePlan(kind: FileKind, size: number): { maxSide: number, square: boolean } | null {
  if (kind === 'attachment') return null
  if (kind === 'user_background') return size > BACKGROUND_MAX_BYTES ? { maxSide: BACKGROUND_SIDE, square: false } : null
  return { maxSide: FACE_SIDE, square: true }
}

export function averageHex(rgba: Uint8ClampedArray): string {
  const sum = [0, 0, 0]
  const pixels = rgba.length / 4
  for (let i = 0; i < rgba.length; i += 4) {
    sum[0]! += rgba[i]!
    sum[1]! += rgba[i + 1]!
    sum[2]! += rgba[i + 2]!
  }
  return `#${sum.map(v => Math.round(v / pixels).toString(16).padStart(2, '0')).join('')}`
}

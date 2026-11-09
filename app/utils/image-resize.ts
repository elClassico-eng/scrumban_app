import { averageHex } from './upload-image-plan'

export async function resizeImage(file: Blob, opts: { maxSide: number, square: boolean }): Promise<{ blob: Blob, width: number, height: number }> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = opts.square ? (bitmap.width - side) / 2 : 0
  const sy = opts.square ? (bitmap.height - side) / 2 : 0
  const sw = opts.square ? side : bitmap.width
  const sh = opts.square ? side : bitmap.height
  const scale = Math.min(1, opts.maxSide / Math.max(sw, sh))
  const width = Math.round(sw * scale)
  const height = Math.round(sh * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Не удалось сжать картинку'))), 'image/webp', 0.85))
  return { blob, width, height }
}

const COLOR_SAMPLE = 32

export async function imageInfo(file: Blob): Promise<{ width: number, height: number, color: string }> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = COLOR_SAMPLE
  canvas.height = COLOR_SAMPLE
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, COLOR_SAMPLE, COLOR_SAMPLE)
  const info = { width: bitmap.width, height: bitmap.height, color: averageHex(ctx.getImageData(0, 0, COLOR_SAMPLE, COLOR_SAMPLE).data) }
  bitmap.close()
  return info
}

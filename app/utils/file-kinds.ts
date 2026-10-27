const UNITS = ['Б', 'КБ', 'МБ', 'ГБ']

export function formatBytes(n: number): string {
  let value = n
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${UNITS[unit]}`
}

export function isPreviewableImage(contentType: string): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)
}

export function fileIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return 'i-hugeicons-image-01'
  if (contentType === 'application/pdf') return 'i-hugeicons-pdf-01'
  if (/sheet|excel|csv/.test(contentType)) return 'i-hugeicons-xls-01'
  if (/zip|rar|7z|tar|gzip/.test(contentType)) return 'i-hugeicons-zip-01'
  if (/word|document|text/.test(contentType)) return 'i-hugeicons-file-01'
  return 'i-hugeicons-file-attachment'
}

export function fileIdFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/^\/api\/files\/(?:w\/[0-9a-f-]+|u)\/([0-9a-f-]{36})/)
  return m?.[1] ?? null
}

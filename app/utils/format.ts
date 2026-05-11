export function formatRelativeDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }).format(
    Math.round((d.getTime() - Date.now()) / 86_400_000),
    'day',
  )
}

export function formatPercentile(value: number, total: number): string {
  return `${Math.round((value / total) * 100)}%`
}
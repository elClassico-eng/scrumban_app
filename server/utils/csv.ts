export type CsvColumn = { key: string; header: string }

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return String(value).replace('.', ',')
  const raw = value instanceof Date ? value.toISOString() : String(value)
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return /[;"\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(';')]
  for (const row of rows) lines.push(columns.map((c) => cell(row[c.key])).join(';'))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

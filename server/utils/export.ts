import type { H3Event } from 'h3'
import { toCsv, type CsvColumn } from './csv'

export function sendExport(
  event: H3Event,
  input: { rows: Record<string, unknown>[]; columns: CsvColumn[]; format: 'csv' | 'json'; name: string },
): string | Record<string, unknown>[] {
  const stamp = new Date().toISOString().slice(0, 10)
  if (input.format === 'json') {
    setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${input.name}-${stamp}.json"`)
    return input.rows
  }
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${input.name}-${stamp}.csv"`)
  return toCsv(input.rows, input.columns)
}

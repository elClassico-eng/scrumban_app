import { describe, expect, it } from 'vitest'
import { toCsv } from '../server/utils/csv'

const columns = [
  { key: 'name', header: 'Спринт' },
  { key: 'days', header: 'Дней' },
  { key: 'hit', header: 'Попал' },
]

describe('toCsv', () => {
  it('starts with a BOM and a header line', () => {
    const out = toCsv([], columns)
    expect(out.startsWith('\uFEFF')).toBe(true)
    expect(out.slice(1)).toBe('Спринт;Дней;Попал\r\n')
  })

  it('escapes separators, quotes and newlines', () => {
    const out = toCsv([{ name: 'a;b "x"\nc', days: 1.5, hit: true }], columns)
    expect(out.slice(1).split('\r\n')[1]).toBe('"a;b ""x""\nc";1.5;true')
  })

  it('renders null and undefined as empty, dates as ISO', () => {
    const out = toCsv([{ name: null, days: undefined, hit: new Date('2026-10-01T00:00:00Z') }], columns)
    expect(out.slice(1).split('\r\n')[1]).toBe(';;2026-10-01T00:00:00.000Z')
  })
})

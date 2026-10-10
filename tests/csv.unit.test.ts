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
    expect(out.slice(1).split('\r\n')[1]).toBe('"a;b ""x""\nc";1,5;true')
  })

  it('neutralises spreadsheet formulas in text cells but keeps negative numbers', () => {
    const out = toCsv([{ name: '=HYPERLINK("x")', days: -1.5, hit: '@SUM(A1)' }], columns)
    expect(out.slice(1).split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")";-1,5;'@SUM(A1)`)
  })

  it('writes decimals with a comma for Russian Excel', () => {
    const out = toCsv([{ name: 'a', days: 6.5, hit: 7 }], columns)
    expect(out.slice(1).split('\r\n')[1]).toBe('a;6,5;7')
  })

  it('renders null and undefined as empty, dates as ISO', () => {
    const out = toCsv([{ name: null, days: undefined, hit: new Date('2026-10-01T00:00:00Z') }], columns)
    expect(out.slice(1).split('\r\n')[1]).toBe(';;2026-10-01T00:00:00.000Z')
  })
})

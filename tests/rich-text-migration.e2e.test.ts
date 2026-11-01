import { afterAll, describe, expect, it } from 'vitest'
import { closeTestSql, getTestSql } from './helpers/db'

afterAll(async () => {
  await closeTestSql()
})

const ID = '0b6f3c1e-8a3d-4c2b-9f7a-1d2e3f4a5b6c'

describe('plain_to_markdown', () => {
  it.each([
    ['одна строка', 'одна строка'],
    ['первая\nвторая', 'первая\\\nвторая'],
    ['абзац\n\nдругой', 'абзац\n\nдругой'],
    ['Шаги:\n- раз\n- два', 'Шаги:\n- раз\n- два'],
    ['1. раз\n2. два', '1. раз\n2. два'],
    ['текст\n> цитата', 'текст\n> цитата'],
    ['текст\n## заголовок', 'текст\n## заголовок'],
    [`@[Иван](${ID})\nhttps://x.ru/a_b`, `@[Иван](${ID})\\\nhttps://x.ru/a_b`],
    ['конец\n', 'конец\n'],
    ['win\r\nline', 'win\\\nline'],
    ['', ''],
    ['```\nconst a = 1\nconst b = 2\n```', '```\nconst a = 1\nconst b = 2\n```'],
  ])('%j', async (input, expected) => {
    const [row] = await getTestSql()`SELECT plain_to_markdown(${input}) AS out`
    expect(row!.out).toBe(expected)
  })

  it('grows a text exactly by the number of converted line breaks', async () => {
    const [row] = await getTestSql()`SELECT length(plain_to_markdown(${'a\nb\nc'})) AS len`
    expect(row!.len).toBe(7)
  })
})

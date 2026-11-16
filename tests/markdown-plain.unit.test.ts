import { describe, expect, it } from 'vitest'
import { markdownToPlain } from '../server/utils/markdown-plain'

const ID = '0b6f3c1e-8a3d-4c2b-9f7a-1d2e3f4a5b6c'

describe('markdownToPlain', () => {
  it.each([
    [`@[Иван](${ID}), глянь`, '@Иван, глянь'],
    ['**жирный** и *курсив* и ~~зачёркнуто~~ и `код`', 'жирный и курсив и зачёркнуто и код'],
    ['см. [доку](https://x.ru) ![скрин](/api/files/w/a/b)', 'см. доку [картинка]'],
    ['## Шаги\n- раз\n- [ ] два\n1. три\n> цитата', 'Шаги раз два три цитата'],
    ['строка\\\nвторая', 'строка вторая'],
    ['```ts\nconst a = 1\n```', 'const a = 1'],
    ['snake_case_name и 2*3', 'snake_case_name и 2*3'],
    ['экранирую \\*звёздочку\\*', 'экранирую *звёздочку*'],
  ])('%s', (input, expected) => {
    expect(markdownToPlain(input)).toBe(expected)
  })
})

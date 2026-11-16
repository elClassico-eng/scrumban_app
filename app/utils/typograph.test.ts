import { describe, expect, it } from 'vitest'
import { glueShortWords } from './typograph'

const NBSP = ' '

describe('glueShortWords', () => {
  it('glues a one-letter conjunction to the next word', () => {
    expect(glueShortWords('Всё, что нужно потоку. И ничего лишнего')).toBe(`Всё, что нужно потоку. И${NBSP}ничего лишнего`)
  })

  it('glues short prepositions, including consecutive ones', () => {
    expect(glueShortWords('Данные в России и на серверах')).toBe(`Данные в${NBSP}России и${NBSP}на${NBSP}серверах`)
  })

  it('leaves longer words and Latin text alone', () => {
    expect(glueShortWords('Работает рядом с вашими tools')).toBe(`Работает рядом с${NBSP}вашими tools`)
  })
})

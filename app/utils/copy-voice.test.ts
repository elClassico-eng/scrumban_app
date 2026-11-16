import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Users are always addressed formally («вы»). The list covers pronouns and the
// singular imperatives that UI copy tends to slip into.
const INFORMAL = [
  'ты', 'тебя', 'тебе', 'тобой', 'твой', 'твоя', 'твоё', 'твои', 'твоих', 'твоим', 'твоей', 'твоего', 'твою',
  'можешь', 'хочешь', 'сможешь', 'знаешь', 'видишь', 'получишь', 'найдёшь',
  'попробуй', 'проверь', 'введи', 'выбери', 'нажми', 'создай', 'добавь', 'укажи', 'зайди', 'открой',
  'перейди', 'обнови', 'напиши', 'оставь', 'посмотри', 'настрой', 'подключи', 'переведи', 'сохрани',
  'удали', 'назначь', 'вернись', 'подтверди', 'отметь', 'запусти', 'перетащи', 'кликни', 'загрузи',
  'скопируй', 'вставь', 'используй', 'убедись', 'поставь', 'заполни', 'дождись', 'попроси',
]
const PATTERN = new RegExp(`(^|[^а-яёА-ЯЁ])(${INFORMAL.join('|')})(?=[^а-яёА-ЯЁ]|$)`, 'i')

const ROOT = join(__dirname, '..', '..')
const DIRS = ['app', 'server', 'shared', 'content']
const EXT = /\.(vue|ts|md)$/
const SKIP = /(\.test\.ts|\.d\.ts)$/

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (EXT.test(name) && !SKIP.test(name)) out.push(path)
  }
  return out
}

describe('copy voice', () => {
  it('never addresses the user informally', () => {
    const hits: string[] = []
    for (const dir of DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
          const m = line.match(PATTERN)
          if (m) hits.push(`${relative(ROOT, file)}:${i + 1}  «${m[2]}»  ${line.trim().slice(0, 100)}`)
        })
      }
    }
    expect(hits, hits.join('\n')).toEqual([])
  })
})

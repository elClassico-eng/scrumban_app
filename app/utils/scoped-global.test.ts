import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// In a <style scoped> block Vue compiles `:global(.a) .b` to just `.a`, silently
// dropping the rest of the selector. That once turned `:global(html.takt-seen) .lloader`
// into `html.takt-seen { display: none }` and blanked the landing on reload.
describe('scoped styles', () => {
  it('never combine :global() with a descendant selector', () => {
    const dir = join(__dirname, '..', 'components', 'landing')
    const hits: string[] = []
    for (const name of readdirSync(dir).filter(n => n.endsWith('.vue'))) {
      const src = readFileSync(join(dir, name), 'utf8')
      const scoped = src.match(/<style[^>]*\bscoped\b[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? ''
      scoped.split('\n').forEach((line, i) => {
        if (/:global\([^)]*\)\s*[.#\w[:]/.test(line)) hits.push(`${name}: ${line.trim()} (style line ${i + 1})`)
      })
    }
    expect(hits, hits.join('\n')).toEqual([])
  })
})

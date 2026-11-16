import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// In a <style scoped> block Vue compiles `:global(.a) .b` to just `.a`, silently
// dropping the rest of the selector. That once turned `:global(html.takt-seen) .lloader`
// into `html.takt-seen { display: none }` and blanked the landing on reload, and turned
// `:global(.dark) .rich-editor .mention` into `.dark { background: … }`, tinting the
// dark sidebar and page once a task card had been opened.
describe('scoped styles', () => {
  it('never combine :global() with a descendant selector', () => {
    const appDir = join(__dirname, '..')
    const files = (readdirSync(appDir, { recursive: true }) as string[]).filter(n => n.endsWith('.vue'))
    const hits: string[] = []
    for (const name of files) {
      const src = readFileSync(join(appDir, name), 'utf8')
      const scoped = [...src.matchAll(/<style[^>]*\bscoped\b[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
      scoped.split('\n').forEach((line, i) => {
        if (/:global\([^)]*\)\s*[.#\w[:]/.test(line)) hits.push(`${relative(appDir, join(appDir, name))}: ${line.trim()} (style line ${i + 1})`)
      })
    }
    expect(hits, hits.join('\n')).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { MarkdownManager } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { MentionToken, parseMentionToken } from '../app/utils/editor-mention'
import { IMAGE_OPTIONS, ImageParagraph } from '../app/utils/editor-config'

const ID = '0b6f3c1e-8a3d-4c2b-9f7a-1d2e3f4a5b6c'
const extensions = [StarterKit.configure({ paragraph: false }), ImageParagraph, Image.configure(IMAGE_OPTIONS), TaskList, TaskItem, MentionToken]
const md = new MarkdownManager({ extensions: extensions as never })
const schema = getSchema(extensions)
const roundTrip = (src: string) => md.serialize(md.parse(src))

describe('mention token', () => {
  it('parses the stored format', () => {
    expect(parseMentionToken(`@[Иван Петров](${ID}) привет`)).toEqual({ raw: `@[Иван Петров](${ID})`, label: 'Иван Петров', id: ID })
    expect(parseMentionToken('@[x](not-a-uuid)')).toBeNull()
  })

  it('round-trips mentions next to text', () => {
    const src = `Привет, @[Иван Петров](${ID}), глянь и @[Ann](${ID.toUpperCase()})`
    const json = JSON.stringify(md.parse(src))
    expect(json).toContain('"type":"mention"')
    expect(roundTrip(src)).toBe(`Привет, @[Иван Петров](${ID}), глянь и @[Ann](${ID})`)
  })

  it('keeps ordinary links as links', () => {
    expect(roundTrip('см. [доку](https://takt34.tech/docs)')).toBe('см. [доку](https://takt34.tech/docs)')
  })

  it('round-trips images and task lists', () => {
    expect(roundTrip('![скрин](/api/files/w/a/b)')).toBe('![скрин](/api/files/w/a/b)')
    expect(roundTrip('- [ ] сделать\n- [x] готово')).toBe('- [ ] сделать\n- [x] готово')
  })

  it('keeps an image pasted into a list item valid for the editor schema', () => {
    const doc = schema.nodeFromJSON(md.parse('- пункт\n  ![скрин](/api/files/w/a/b)'))
    expect(() => doc.check()).not.toThrow()
    expect(JSON.stringify(doc.toJSON())).toContain('"src":"/api/files/w/a/b"')
  })

  it.each([
    ['![скрин](/api/files/w/a/b)'],
    ['текст\n\n![скрин](/api/files/w/a/b)\n\nещё'],
  ])('keeps a lone image valid for the editor schema: %j', (src) => {
    const doc = schema.nodeFromJSON(md.parse(src))
    expect(() => doc.check()).not.toThrow()
    expect(JSON.stringify(doc.toJSON())).toContain('"src":"/api/files/w/a/b"')
  })

  it('keeps raw html as literal text', () => {
    const html = '<script>alert(1)</script> <img src=x onerror=alert(1)>'
    expect(md.parse(html)).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: html }] }] })
  })
})

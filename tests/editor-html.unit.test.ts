// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { MarkdownManager } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { IMAGE_OPTIONS, ImageParagraph, textOnlyMarked } from '../app/utils/editor-config'

const md = new MarkdownManager({
  marked: textOnlyMarked,
  extensions: [StarterKit.configure({ paragraph: false }), ImageParagraph, Image.configure(IMAGE_OPTIONS)] as never,
})
const text = (src: string) => JSON.stringify(md.parse(src))

describe('raw html in markdown (browser parse path)', () => {
  it('keeps inline tags as literal text', () => {
    const json = text('Кнопка <Button> не реагирует, поправить <select>')
    expect(json).toContain('<Button>')
    expect(json).toContain('<select>')
  })

  it('keeps block html as literal text and never makes an image', () => {
    const json = text('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
    expect(json).toContain('<script>alert(1)</script>')
    expect(json).not.toContain('"type":"image"')
  })
})

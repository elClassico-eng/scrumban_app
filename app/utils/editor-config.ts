import Paragraph from '@tiptap/extension-paragraph'
import { marked, type Tokens } from 'marked'

export const IMAGE_OPTIONS = { inline: true }

const baseParseMarkdown = Paragraph.config.parseMarkdown

export const ImageParagraph = Paragraph.extend({
  parseMarkdown(token, helpers) {
    const tokens = token.tokens ?? []
    if (tokens.length === 1 && tokens[0]?.type === 'image') {
      return helpers.createNode('paragraph', undefined, helpers.parseInline(tokens))
    }
    return baseParseMarkdown!.call(this, token, helpers)
  },
})

marked.use({
  tokenizer: {
    html(src) {
      const m = this.rules.block.html.exec(src)
      return m ? ({ type: 'paragraph', raw: m[0], text: m[0], tokens: [{ type: 'text', raw: m[0], text: m[0] }] } as unknown as Tokens.HTML) : undefined
    },
    tag(src) {
      const m = this.rules.inline.tag.exec(src)
      return m ? ({ type: 'text', raw: m[0], text: m[0] } as unknown as Tokens.Tag) : undefined
    },
  },
})

export const textOnlyMarked = marked

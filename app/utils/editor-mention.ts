import { mergeAttributes } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import { formatMentionToken } from './mentions'

const TOKEN_RE = /^@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/i

export function parseMentionToken(src: string): { raw: string, label: string, id: string } | null {
  const m = src.match(TOKEN_RE)
  return m ? { raw: m[0], label: m[1]!, id: m[2]!.toLowerCase() } : null
}

export const MentionToken = Mention.extend({
  markdownTokenizer: {
    name: 'mention',
    level: 'inline',
    start: (src: string) => src.search(/@\[[^\]]+\]\(/),
    tokenize(src: string) {
      const t = parseMentionToken(src)
      return t ? { type: 'mention', raw: t.raw, attributes: { id: t.id, label: t.label } } : undefined
    },
  },
  parseMarkdown: (token, h) => h.createNode('mention', token.attributes),
  renderMarkdown: node => formatMentionToken(String(node.attrs?.label ?? ''), String(node.attrs?.id ?? '')),
}).configure({
  HTMLAttributes: { class: 'mention' },
  renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
  renderHTML: ({ options, node }) => ['span', mergeAttributes({ 'data-type': 'mention' }, options.HTMLAttributes), `@${node.attrs.label ?? node.attrs.id}`],
})

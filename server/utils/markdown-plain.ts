const MENTION = /@\[([^\]]+)\]\([0-9a-f-]{36}\)/gi

export function markdownToPlain(md: string): string {
  return md
    .replace(/^```[^\n]*$/gm, '')
    .replace(MENTION, '@$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[картинка]')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*(#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)/gm, '')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[^\w\\])\*([^*\n]+)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w\\])_([^_\n]+)_(?!\w)/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\\\n/g, '\n')
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

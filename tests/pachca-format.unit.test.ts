import { describe, expect, it } from 'vitest'
import { digestMarkdown, escapeMd, notificationMarkdown, quote } from '../server/utils/pachca/format'

describe('pachca format', () => {
  it('escapes markdown control characters', () => {
    expect(escapeMd('a*b_c [x](y) `z`')).toBe('a\\*b\\_c \\[x\\]\\(y\\) \\`z\\`')
  })

  it('quotes long text with an ellipsis', () => {
    const q = quote('x'.repeat(400))
    expect(q.startsWith('> ')).toBe(true)
    expect(q.length).toBe(302)
    expect(q.endsWith('…')).toBe(true)
  })

  it('builds a notification with title, detail and quote', () => {
    const md = notificationMarkdown({ title: 'Вас упомянули', detail: 'Иван · «Оплата»', snippet: 'глянь *срочно*' })
    expect(md).toBe('**Вас упомянули**\nИван · «Оплата»\n> глянь \\*срочно\\*')
  })

  it('renders a digest with sections and overflow', () => {
    const md = digestMarkdown({ id: 'w', name: 'Команда', sections: [{ heading: 'Просрочено', items: [{ title: 'ПОТ-1 Задача', detail: 'просрочено на 2 дн', link: 'https://t/x' }], more: 3 }] })
    expect(md).toContain('**Просрочено**')
    expect(md).toContain('- [ПОТ-1 Задача](https://t/x) · просрочено на 2 дн')
    expect(md).toContain('и ещё 3')
  })
})

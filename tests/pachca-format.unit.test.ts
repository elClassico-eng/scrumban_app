import { describe, expect, it } from 'vitest'
import { digestMarkdown, escapeMd, FEED_LINE_LIMIT, feedMarkdown, notificationMarkdown, quote, type FeedItem } from '../server/utils/pachca/format'

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

describe('feed markdown', () => {
  it('groups by kind and caps lines', () => {
    const closed: FeedItem[] = Array.from({ length: 12 }, (_, i) => ({ kind: 'task_closed', key: `ПОТ-${i}`, title: `Задача ${i}`, link: `https://t/${i}` }))
    const md = feedMarkdown('Поток', [...closed, { kind: 'task_blocked', key: 'ПОТ-99', title: 'Ждём', link: 'https://t/99', reason: 'доступ' }])
    expect(md.split('\n')[0]).toBe('**Поток**')
    expect(md).toContain('**Закрыто: 12**')
    expect(md.match(/^- /gm)).toHaveLength(FEED_LINE_LIMIT)
    expect(md).toContain('и ещё 3')
  })

  it('shows blocker reasons and sprints', () => {
    const md = feedMarkdown('Поток', [
      { kind: 'task_blocked', key: 'ПОТ-1', title: 'A', link: 'https://t/1', reason: 'ждём *API*' },
      { kind: 'sprint_started', name: 'Спринт 7', link: 'https://t/s' },
    ])
    expect(md).toContain('- [ПОТ-1 A](https://t/1) · ждём \\*API\\*')
    expect(md).toContain('**Спринт начат: 1**')
  })
})

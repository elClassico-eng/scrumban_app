import { describe, expect, it } from 'vitest'
import { faqJsonLd } from './landing-content'

describe('faqJsonLd', () => {
  it('builds a schema.org FAQPage', () => {
    const ld = faqJsonLd([{ q: 'Это бесплатно?', a: 'Да.' }])
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('FAQPage')
    const [first] = ld.mainEntity as Array<{ name: string, acceptedAnswer: { text: string } }>
    expect(first!.name).toBe('Это бесплатно?')
    expect(first!.acceptedAnswer.text).toBe('Да.')
  })
})

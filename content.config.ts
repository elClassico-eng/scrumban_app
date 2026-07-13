import { defineContentConfig, defineCollection, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: 'docs/**',
      schema: z.object({
        navTitle: z.string().optional(),
        tab: z.string().optional(),
        section: z.string().optional(),
        order: z.number().default(0),
      }),
    }),
    changelog: defineCollection({
      type: 'page',
      source: 'changelog/**',
      schema: z.object({
        date: z.string(),
        area: z.string(),
        tryRoute: z.string().optional(),
        docsPath: z.string().optional(),
      }),
    }),
  },
})

export default defineNuxtConfig({
  compatibilityDate: '2025-04-01',
  devtools: { enabled: true },
  ssr: true,
  $development: { ssr: false },

  routeRules: {
    '/**': { ssr: false },
    '/': { prerender: true, ssr: true },
    '/docs/**': { prerender: true, ssr: true },
  },

  app: {
    head: {
      title: 'Такт',
      htmlAttrs: { lang: 'ru' },
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/content',
    '@nuxtjs/google-fonts',
    'nuxt-auth-utils',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],

  content: {
    experimental: { sqliteConnector: 'native' },
    build: {
      markdown: {
        remarkPlugins: {
          'remark-math': {},
        },
        rehypePlugins: {
          'rehype-katex': {},
        },
      },
    },
  },

  css: ['katex/dist/katex.min.css', '~/assets/css/main.css'],

  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'accent'],
    },
  },

  imports: {
    dirs: ['composables/**', 'utils/**'],
  },

  googleFonts: {
    families: {
      Manrope: [400, 500, 600, 700, 800],
      'JetBrains Mono': [400, 500, 600],
      Geist: [400, 500, 600, 700, 800],
      Unbounded: [500, 600, 700, 800],
    },
    display: 'swap',
  },

  nitro: {
    experimental: { tasks: true },
    prerender: {
      crawlLinks: true,
      routes: ['/', '/docs'],
    },
    scheduledTasks: {
      '0 * * * *': ['notifications:check-sle-breaches'],
      '0 9 * * *': ['notifications:check-replenishment'],
      '0 */6 * * *': ['notifications:check-sprint-forecast'],
      '0 3 * * *': ['forecast:daily-snapshots'],
    },
    externals: {
      inline: ['zod'],
    },
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    session: {
      password: '',
      maxAge: 60 * 60 * 24 * 30,
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})

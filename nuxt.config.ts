// Nuxt 4 config: SPA-mode (no SSR), backend lives in server/ via Nitro.
// runtimeConfig values are read from env at runtime (DATABASE_URL, NUXT_SESSION_PASSWORD, etc.).
export default defineNuxtConfig({
  compatibilityDate: '2025-04-01',
  devtools: { enabled: true },
  ssr: false,

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxtjs/google-fonts',
    'nuxt-auth-utils',
    '@pinia/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  // Nuxt only auto-imports composables/*.{ts} at the top level by default.
  // We organise composables by domain (api/, domain/, ...), so opt in
  // to recursive scanning for both composables/ and utils/.
  imports: {
    dirs: ['composables/**', 'utils/**'],
  },

  googleFonts: {
    families: {
      Manrope: [400, 500, 600, 700, 800],
      'JetBrains Mono': [400, 500],
    },
    display: 'swap',
  },

  nitro: {
    experimental: { tasks: true },
    scheduledTasks: {
      '0 * * * *': ['notifications:check-sle-breaches'],
      '0 9 * * *': ['notifications:check-replenishment'],
      '0 */6 * * *': ['notifications:check-sprint-forecast'],
    },
    // Inline zod so subpath imports like `zod/v4/locales/ru` (used in the
    // Nitro plugin to localise validation errors) end up in the build output.
    // Without this, Nitro leaves zod external and the locale subpath is
    // missing from .output/server/node_modules.
    externals: {
      inline: ['zod'],
    },
  },

  runtimeConfig: {
    // Server-only secrets. Nuxt auto-overrides keys via NUXT_* env vars
    // (NUXT_SESSION_PASSWORD); for unprefixed names like DATABASE_URL we map
    // explicitly so that .env keeps the standard variable name.
    databaseUrl: process.env.DATABASE_URL || '',
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || '',
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})

// Nuxt 4 config: SPA-mode (no SSR), backend lives in server/ via Nitro.
// runtimeConfig values are read from env at runtime (DATABASE_URL, NUXT_SESSION_PASSWORD, etc.).
export default defineNuxtConfig({
  compatibilityDate: '2025-04-01',
  devtools: { enabled: true },
  ssr: false,

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    'nuxt-auth-utils',
  ],

  runtimeConfig: {
    databaseUrl: '',
    sessionPassword: '',
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})

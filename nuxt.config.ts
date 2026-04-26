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

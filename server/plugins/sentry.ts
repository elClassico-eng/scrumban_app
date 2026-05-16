import * as Sentry from '@sentry/node'

export default defineNitroPlugin((nitroApp) => {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,
  })

  nitroApp.hooks.hook('error', (error, { event }) => {
    Sentry.captureException(error, {
      tags: { route: event?.path },
    })
  })
})

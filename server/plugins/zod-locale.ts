// Wire the Russian zod locale globally so validation errors thrown by
// readValidatedBody / parse() arrive in Russian without per-schema customisation.
// Runs once at Nitro startup.
import { z } from 'zod'
import ruLocale from 'zod/v4/locales/ru'

export default defineNitroPlugin(() => {
  z.config(ruLocale())
})

// Vitest configuration. Uses @nuxt/test-utils' helper so tests can
// boot a real Nuxt instance via setup() / $fetch().
//
// globalSetup runs ONCE before any test files (creates the test database
// and applies migrations). Per-test cleanup (TRUNCATE) is handled with
// resetDb() in tests/helpers/db.ts.
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globalSetup: ['./tests/setup.global.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    include: ['tests/**/*.test.ts'],
    // Server-side tests don't need a browser-like environment.
    environment: 'node',
    // Test files share a single test database; running them in parallel
    // produces non-deterministic failures because TRUNCATE in beforeEach
    // races other files' inserts. Force serial file execution.
    fileParallelism: false,
  },
})

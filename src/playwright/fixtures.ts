import { test as base, type Page } from '@playwright/test'
import type { TestUser } from '../types'
import { buildAuthCookie } from '../helpers/auth'

export { expect } from '@playwright/test'

interface AuthFixturesConfig {
  users: Record<string, TestUser>
  baseUrl?: string
}

/**
 * Creates a Playwright test object extended with authenticated page fixtures.
 * For each key K in users, a `${K}Page` fixture is created that injects
 * that user's auth cookie into the page context before use.
 */
export function createAuthFixtures(config: AuthFixturesConfig) {
  const { users, baseUrl } = config
  const resolvedBaseUrl =
    baseUrl ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

  const fixtures: Record<string, unknown> = {}

  for (const [key, user] of Object.entries(users)) {
    fixtures[`${key}Page`] = [
      async ({ page }: { page: Page }, use: (page: Page) => Promise<void>) => {
        const cookie = await buildAuthCookie(user, resolvedBaseUrl)
        await page.context().addCookies([cookie])
        await use(page)
      },
      { scope: 'test' },
    ]
  }

  return base.extend<Record<string, Page>>(fixtures as never)
}

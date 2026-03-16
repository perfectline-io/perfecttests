/**
 * Shared Playwright config factory.
 *
 * This module intentionally does NOT import @playwright/test to avoid
 * dual-instance errors when consumed via workspace symlinks. Playwright's
 * defineConfig() is an identity function — we just return a plain object.
 * Device descriptors are inlined from Playwright's device registry.
 */

type DeviceShorthand = 'chromium' | 'mobile-safari' | 'firefox'

const DEVICE_MAP: Record<DeviceShorthand, { name: string; use: Record<string, unknown> }> = {
  chromium: {
    name: 'chromium',
    use: {
      defaultBrowserType: 'chromium',
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
  },
  'mobile-safari': {
    name: 'mobile-safari',
    use: {
      defaultBrowserType: 'webkit',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    },
  },
  firefox: {
    name: 'firefox',
    use: {
      defaultBrowserType: 'firefox',
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    },
  },
}

export interface PlaywrightConfigOptions {
  testDir?: string
  fullyParallel?: boolean
  workers?: number
  projects?: DeviceShorthand[]
  webServerCommand?: string
  webServerPort?: number
  use?: Record<string, unknown>
  globalSetup?: string
  globalTeardown?: string
}

/**
 * Factory for shared Playwright config across all PerfectLine apps.
 * Loads .env.test, detects CI, configures retries/reporters/webServer.
 */
export function createPlaywrightConfig(options: PlaywrightConfigOptions = {}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: '.env.test' })
  } catch {
    // dotenv is optional — .env.test may not exist or dotenv may not be installed
  }

  const isCI = !!process.env.CI
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

  const projectShorthands = options.projects ?? ['chromium']
  const expandedProjects = projectShorthands.map((key: DeviceShorthand) => DEVICE_MAP[key])

  return {
    testDir: options.testDir ?? './e2e',
    fullyParallel: options.fullyParallel ?? false,
    forbidOnly: isCI,
    retries: isCI ? 1 : 0,
    workers: options.workers ?? 1,
    reporter: [['html', { open: 'never' }], ['list']],

    use: {
      baseURL,
      trace: 'on-first-retry' as const,
      screenshot: 'only-on-failure' as const,
      ...options.use,
    },

    ...(options.globalSetup && { globalSetup: options.globalSetup }),
    ...(options.globalTeardown && { globalTeardown: options.globalTeardown }),

    projects: expandedProjects,

    webServer: isCI
      ? undefined
      : {
          command: options.webServerCommand ?? 'bun dev',
          url: baseURL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
  }
}

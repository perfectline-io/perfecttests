# @perfectline-io/testing

Shared testing infrastructure for the PerfectLine monorepo. Provides config factories, auth fixtures, mock factories, health collectors, and CLI tools so every app gets a consistent test setup with minimal boilerplate.

## Install

The package is private and workspace-linked. Add it as a dev dependency:

```json
{
  "devDependencies": {
    "@perfectline-io/testing": "workspace:*"
  }
}
```

Then run `bun install`.

## Quick Start

### Jest

```ts
// jest.config.ts
import { createJestConfig } from '@perfectline-io/testing/jest'

export default createJestConfig()
```

### Playwright

```ts
// playwright.config.ts
import { createPlaywrightConfig } from '@perfectline-io/testing/playwright'

export default createPlaywrightConfig({
  testDir: './e2e',
  projects: ['chromium', 'mobile-safari'],
})
```

### Auth Fixtures (Playwright)

```ts
// e2e/fixtures.ts
import { createAuthFixtures, expect } from '@perfectline-io/testing/playwright/fixtures'

const TEST_USERS = {
  free: { id: 'uuid-1', email: 'free@test.io', name: 'Free User' },
  admin: { id: 'uuid-2', email: 'admin@test.io', name: 'Admin', role: 'admin' },
}

export const test = createAuthFixtures({ users: TEST_USERS })
export { expect }
```

Then in tests:

```ts
import { test, expect } from '../fixtures'

test('admin can see dashboard', async ({ adminPage }) => {
  await adminPage.goto('/admin')
  await expect(adminPage.locator('h1')).toContainText('Dashboard')
})
```

### Mocks (Jest)

```ts
import { mockSession, mockUnauthenticated, createMockRequest } from '@perfectline-io/testing/mocks'
import { mockPlatform } from '@perfectline-io/testing/mocks/platform'

const platform = mockPlatform()

describe('POST /api/billing/checkout', () => {
  it('returns 401 when unauthenticated', async () => {
    mockUnauthenticated()
    const req = createMockRequest('/api/billing/checkout', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('creates a checkout session', async () => {
    mockSession({ id: 'user-1', email: 'test@test.com', name: 'Test' })
    const req = createMockRequest('/api/billing/checkout', {
      method: 'POST',
      body: { priceId: 'price_123' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(platform.billing.createCheckoutSession).toHaveBeenCalled()
  })
})
```

---

## Package Exports

| Import Path | What It Provides |
|---|---|
| `@perfectline-io/testing` | Core types (`TestUser`, `TestConfig`, `Collector`, etc.) |
| `@perfectline-io/testing/jest` | `createJestConfig()` |
| `@perfectline-io/testing/jest/setup` | Shared Jest setup (auto-imported by config) |
| `@perfectline-io/testing/playwright` | `createPlaywrightConfig()` |
| `@perfectline-io/testing/playwright/fixtures` | `createAuthFixtures()`, `expect` |
| `@perfectline-io/testing/playwright/setup` | `createGlobalSetup()`, `createGlobalTeardown()` |
| `@perfectline-io/testing/mocks` | `mockSession()`, `mockUnauthenticated()`, `mockPlatform()`, `createMockRequest()` |
| `@perfectline-io/testing/mocks/session` | `mockSession()`, `mockUnauthenticated()` |
| `@perfectline-io/testing/mocks/platform` | `mockPlatform()` |
| `@perfectline-io/testing/mocks/next-request` | `createMockRequest()` |
| `@perfectline-io/testing/helpers/auth` | `mintSessionToken()`, `buildAuthCookie()` |
| `@perfectline-io/testing/helpers/db` | `seedTestUsers()` |
| `@perfectline-io/testing/health` | `runHealthCheck()` + all health sub-exports |
| `@perfectline-io/testing/health/collectors` | `defaultCollectors`, individual collectors |

---

## API Reference

### Types

```ts
interface TestUser {
  id: string
  email: string
  name: string
  role?: string
  tier?: string
}

interface TestConfig {
  appName: string
  baseUrl?: string
  databaseUrl?: string
}

interface CollectorResult {
  dimension: string
  rawScore: number
  metrics: Record<string, number | string>
  issues: HealthIssue[]
  timestamp: string
}

interface HealthIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
  rule?: string
  fix?: string
}

interface Collector {
  name: string
  dimension: string
  weight: number
  collect(servicePath: string): Promise<CollectorResult>
}

interface ServiceHealth {
  service: string
  path: string
  dimensions: CollectorResult[]
  compositeScore: number
  grade: string
  issueCount: { error: number; warning: number; info: number }
  timestamp: string
}

interface HealthSnapshot {
  generated: string
  gitSha: string
  gitBranch: string
  services: ServiceHealth[]
}
```

---

### Jest

#### `createJestConfig(options?)`

Factory that returns a complete Jest configuration with sensible defaults.

```ts
import { createJestConfig } from '@perfectline-io/testing/jest'

// Minimal — all defaults
export default createJestConfig()

// With overrides
export default createJestConfig({
  testEnvironment: 'node',
  testTimeout: 30000,
  coverageFrom: ['lib/**/*.ts', 'components/**/*.tsx'],
  coverageLevel: 'strict',
})
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `testEnvironment` | `string` | `'jsdom'` | Jest test environment |
| `testTimeout` | `number` | `10000` | Per-test timeout in ms |
| `coverageFrom` | `string[]` | `['lib/**/*.ts', 'components/**/*.tsx', 'app/**/*.ts', 'app/**/*.tsx']` | Files to collect coverage from |
| `coverageLevel` | `'minimal' \| 'standard' \| 'strict'` | `'standard'` | Coverage threshold preset |

**Coverage Levels:**

| Level | Branches | Functions | Lines | Statements |
|---|---|---|---|---|
| `minimal` | 30% | 30% | 30% | 30% |
| `standard` | 60% | 60% | 60% | 60% |
| `strict` | 80% | 80% | 80% | 80% |

**Defaults applied:**
- Setup file: `@perfectline-io/testing/jest/setup`
- Path alias: `@/*` mapped to `<rootDir>/`
- Test patterns: `**/*.test.ts`, `**/*.test.tsx`
- Ignores: `e2e/`, `node_modules/`, `.next/`
- Coverage provider: `v8`

#### Jest Setup (`@perfectline-io/testing/jest/setup`)

Automatically imported by `createJestConfig()`. Provides:

- `@testing-library/jest-dom` matchers
- `Element.prototype.setPointerCapture` / `releasePointerCapture` / `hasPointerCapture` stubs
- `IntersectionObserver` stub
- `ResizeObserver` stub

All stubs are guarded by `typeof Element !== 'undefined'` so they only apply in jsdom.

---

### Playwright

#### `createPlaywrightConfig(options?)`

Factory that returns a Playwright configuration with environment-aware defaults.

```ts
import { createPlaywrightConfig } from '@perfectline-io/testing/playwright'

export default createPlaywrightConfig({
  testDir: './e2e/tests',
  projects: ['chromium', 'mobile-safari'],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
})
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `testDir` | `string` | `'./e2e'` | Test directory |
| `fullyParallel` | `boolean` | `false` | Run tests in parallel |
| `workers` | `number` | `1` | Worker count |
| `projects` | `DeviceShorthand[]` | `['chromium']` | Browser projects |
| `webServerCommand` | `string` | `'bun dev'` | Dev server command |
| `webServerPort` | `number` | — | Dev server port |
| `globalSetup` | `string` | — | Global setup file path |
| `globalTeardown` | `string` | — | Global teardown file path |
| `use` | `Record<string, unknown>` | — | Extra browser context options |

**Device shorthands:** `'chromium'` (1280x720), `'mobile-safari'` (390x844), `'firefox'` (1280x720)

**CI behavior** (when `process.env.CI` is set):
- `test.only` is forbidden (via `forbidOnly`)
- Retries set to 1
- No webServer (assumes server is already running)

**Local behavior:**
- webServer starts `bun dev`, reuses existing if running, 60s startup timeout

**Other defaults:**
- Base URL from `PLAYWRIGHT_BASE_URL` env var or `http://localhost:3000`
- Trace: `on-first-retry`
- Screenshot: `only-on-failure`
- Reporter: HTML (no auto-open) + list

#### `createAuthFixtures(config)`

Extends Playwright's `test` object with authenticated page fixtures.

```ts
import { createAuthFixtures, expect } from '@perfectline-io/testing/playwright/fixtures'
import type { TestUser } from '@perfectline-io/testing'

const TEST_USERS = {
  free: { id: 'uuid-1', email: 'free@test.io', name: 'Free User' },
  subscriber: { id: 'uuid-2', email: 'sub@test.io', name: 'Subscriber', tier: 'subscriber' },
} satisfies Record<string, TestUser>

export const test = createAuthFixtures({ users: TEST_USERS })
export { expect }
```

For each key in the `users` map, a `${key}Page` fixture is created:
- `free` → `freePage`
- `subscriber` → `subscriberPage`

Each fixture page has an AuthJS session cookie pre-injected so tests start authenticated.

**Config:**

| Field | Type | Default | Description |
|---|---|---|---|
| `users` | `Record<string, TestUser>` | — | Map of fixture name to test user |
| `baseUrl` | `string` | `PLAYWRIGHT_BASE_URL` or `http://localhost:3000` | Base URL for cookie domain |

#### `createGlobalSetup(config)` / `createGlobalTeardown(cleanup?)`

Factories for Playwright global setup/teardown with database seeding.

```ts
// e2e/global-setup.ts
import { createGlobalSetup } from '@perfectline-io/testing/playwright/setup'
import { TEST_USERS } from './helpers/auth'

async function seedUsers(db, users) {
  await db.execute(sql`INSERT INTO users ...`)
}

export default createGlobalSetup({
  users: Object.values(TEST_USERS),
  seedUsers,
  seedData: async (db) => {
    // Optional: seed additional data
  },
})
```

```ts
// e2e/global-teardown.ts
import { createGlobalTeardown } from '@perfectline-io/testing/playwright/setup'

export default createGlobalTeardown(async () => {
  // Optional cleanup
})
```

Requires `DATABASE_URL` environment variable. Connects via Neon HTTP driver + Drizzle.

---

### Mocks

#### `mockSession(user, options?)`

Mocks the session module to return the given user.

```ts
import { mockSession, mockUnauthenticated } from '@perfectline-io/testing/mocks'

mockSession({ id: 'user-1', email: 'test@test.com', name: 'Test User' })
mockUnauthenticated() // shorthand for mockSession(null)
```

**Options:**

| Field | Type | Default | Description |
|---|---|---|---|
| `modulePath` | `string` | `'@/lib/session'` | Module to mock |
| `functionName` | `string` | `'getSession'` | Export to replace |

#### `mockPlatform(overrides?)`

Mocks the Platform SDK client at `@/lib/platform`. Returns the mock object for assertions.

```ts
import { mockPlatform } from '@perfectline-io/testing/mocks/platform'

const platform = mockPlatform()

// Override a specific method
const platform = mockPlatform({
  billing: {
    createCheckoutSession: jest.fn().mockResolvedValue({
      data: { url: 'https://checkout.stripe.com/custom' },
      error: null,
    }),
  },
})
```

**Default mocked methods:**

| Namespace | Methods |
|---|---|
| `billing` | `createCheckoutSession`, `createPortalSession`, `getSubscription` |
| `email` | `send` |
| `storage` | `getUploadUrl`, `getDownloadUrl` |
| `users` | `getUser`, `updateUser` |
| `referrals` | `trackReferral`, `getReferralStats` |

All methods return `{ data: <sensible default>, error: null }` by default.

#### `createMockRequest(path, options?)`

Creates a `NextRequest` instance for testing API routes.

```ts
import { createMockRequest } from '@perfectline-io/testing/mocks'

const req = createMockRequest('/api/billing/checkout', {
  method: 'POST',
  body: { priceId: 'price_123' },
  headers: { 'x-api-key': 'test-key' },
  searchParams: { page: '1' },
  cookies: { theme: 'dark' },
})
```

**Options:**

| Field | Type | Default | Description |
|---|---|---|---|
| `method` | `string` | `'GET'` | HTTP method |
| `body` | `unknown` | — | Request body (serialized as JSON) |
| `headers` | `Record<string, string>` | — | Request headers |
| `searchParams` | `Record<string, string>` | — | URL query parameters |
| `cookies` | `Record<string, string>` | — | Request cookies |

Base URL is `http://localhost:3000`.

---

### Auth Helpers

#### `mintSessionToken(user, secret, salt?)`

Generates a valid AuthJS v5 JWE session token.

```ts
import { mintSessionToken } from '@perfectline-io/testing/helpers/auth'

const token = await mintSessionToken(
  { id: 'user-1', email: 'test@test.com', name: 'Test' },
  process.env.AUTH_SECRET!,
)
```

| Param | Type | Default | Description |
|---|---|---|---|
| `user` | `TestUser` | — | User to encode |
| `secret` | `string` | — | AuthJS secret |
| `salt` | `string` | `'authjs.session-token'` | HKDF salt |

#### `buildAuthCookie(user, baseUrl, secret?)`

Builds a Playwright-compatible cookie object with a valid session token.

```ts
import { buildAuthCookie } from '@perfectline-io/testing/helpers/auth'

const cookie = await buildAuthCookie(user, 'http://localhost:3000')
await page.context().addCookies([cookie])
```

Returns: `{ name, value, domain, path, httpOnly, secure, sameSite }`

Falls back to `process.env.AUTH_SECRET` if `secret` is not provided.

---

### Database Helpers

#### `seedTestUsers(db, users, tableName?)`

Upserts test users into the database using Drizzle SQL.

```ts
import { seedTestUsers } from '@perfectline-io/testing/helpers/db'

await seedTestUsers(db, [
  { id: 'uuid-1', email: 'test@test.io', name: 'Test User' },
])
```

| Param | Type | Default | Description |
|---|---|---|---|
| `db` | `NeonHttpDatabase` | — | Drizzle Neon HTTP client |
| `users` | `TestUser[]` | — | Users to seed |
| `tableName` | `string` | `'users'` | Target table name |

Uses `INSERT ... ON CONFLICT (id) DO UPDATE` for idempotent seeding.

---

### Health System

#### `runHealthCheck(collectors, options)`

Runs health collectors across all discovered services and generates reports.

```ts
import { runHealthCheck } from '@perfectline-io/testing/health'
import { defaultCollectors } from '@perfectline-io/testing/health/collectors'

const results = await runHealthCheck(defaultCollectors, {
  root: process.cwd(),
  format: 'all',
})
```

**Options:**

| Field | Type | Default | Description |
|---|---|---|---|
| `root` | `string` | — | Monorepo root path |
| `output` | `string` | `'.perfectline/health-report'` | Report output directory |
| `format` | `'terminal' \| 'json' \| 'html' \| 'all'` | `'all'` | Report format(s) |
| `skip` | `string[]` | `[]` | Collector names to skip |
| `verbose` | `boolean` | `false` | Show detailed per-dimension breakdown |
| `issueCount` | `number` | `15` | Max issues to display in terminal |
| `servicePath` | `string` | — | Filter to a single service |

#### Collectors

Seven built-in collectors, each implementing the `Collector` interface:

| Collector | Dimension | Weight | What It Checks |
|---|---|---|---|
| `typeSafetyCollector` | Type Safety | 20% | tsc errors, `any` usage, strict tsconfig flags |
| `lintCollector` | Lint Compliance | 15% | ESLint or Biome errors/warnings |
| `coverageCollector` | Test Coverage | 20% | Jest coverage-summary.json or runs `test:coverage` |
| `testHealthCollector` | Test Health | 10% | Test file ratio, Playwright flaky test detection |
| `dependenciesCollector` | Dependency Health | 15% | `bun audit`, outdated deps, optional `knip` for unused deps |
| `bundleCollector` | Bundle Health | 10% | `.next/static/chunks` analysis (Next.js only) |
| `complexityCollector` | Code Complexity | 10% | 300+ line files, circular deps via `madge` |

```ts
import { defaultCollectors, typeSafetyCollector } from '@perfectline-io/testing/health/collectors'

// Use all collectors
runHealthCheck(defaultCollectors, options)

// Use specific collectors
runHealthCheck([typeSafetyCollector, lintCollector], options)
```

#### Grading Scale

| Grade | Score Range |
|---|---|
| A+ | 95 - 100 |
| A | 90 - 94 |
| A- | 85 - 89 |
| B+ | 80 - 84 |
| B | 75 - 79 |
| B- | 70 - 74 |
| C+ | 65 - 69 |
| C | 60 - 64 |
| C- | 55 - 59 |
| D | 50 - 54 |
| F | 0 - 49 |

#### Service Discovery

Services are auto-discovered by walking the monorepo up to 3 levels deep, detecting service type from `package.json` and config files. To override, create `.perfectline/health.json`:

```json
{
  "services": [
    { "name": "perfectideas", "path": "apps/perfectideas", "type": "nextjs" },
    { "name": "platform-api", "path": "platform-api", "type": "hono" }
  ]
}
```

**Detection rules:**
- `next.config.ts/mjs/js` present → `nextjs`
- `hono` in dependencies → `hono`
- `elysia` in dependencies → `elysia`
- `bin` field in package.json → `cli`
- Fallback → `library`

#### Reports

**Terminal:** Colorized table with per-dimension scores, letter grade, and top issues.

**JSON:** Snapshots written to `<output>/snapshots/<YYYY-MM-DD>.json` and `<output>/snapshots/latest.json`. Includes git SHA and branch for traceability.

**HTML:** Single-file report at `<output>/index.html` with inlined CSS/JS and historical trend data from snapshots. No framework, no build step.

---

## CLI Commands

These commands are registered in `pf` (the PerfectLine CLI) and call into this package.

### `pf health [service-path]`

Run health checks across all services or a single service.

```bash
pf health                        # All services, terminal + HTML output
pf health apps/perfectideas      # Single service
pf health --json                 # Include JSON snapshot
pf health --fail-below C         # Exit 1 if any service grades below C
pf health --skip coverage,bundle # Skip specific collectors
pf health --verbose              # Show all issues (not just top 15)
pf health --compare .perfectline/health-report/snapshots/2026-03-01.json
pf health --open                 # Open HTML report in browser
```

| Flag | Description |
|---|---|
| `--json` | Output JSON snapshot |
| `--html` / `--no-html` | Generate HTML report (default: true) |
| `-o, --output <dir>` | Output directory (default: `.perfectline/health-report/`) |
| `--open` | Open HTML report in browser |
| `--compare <file>` | Compare against a previous snapshot |
| `--fail-below <grade>` | Exit with code 1 if any service falls below grade |
| `--skip <list>` | Comma-separated collector names to skip |
| `-v, --verbose` | Show detailed issue list |

### `pf test:gen <app-path>`

Scan an app's source code and generate test skeletons.

```bash
pf test:gen apps/perfectjobs            # Generate unit + E2E skeletons
pf test:gen apps/perfectjobs --dry-run  # Preview without writing
pf test:gen apps/perfectjobs -t unit    # Unit tests only
pf test:gen apps/perfectjobs -t e2e     # E2E tests only
pf test:gen apps/perfectjobs --force    # Overwrite existing tests
pf test:gen apps/perfectjobs -i 'app/api/**/route.ts'  # Limit scope
pf test:gen apps/perfectjobs --verbose  # Show detected patterns
```

**What it scans:** API routes, pages, components, library modules, middleware, server actions.

**Pattern detection:** auth-guard, sdk-call, form-submission, data-fetch, validation. Detected patterns determine what test structure and imports are generated.

**Generated tests include:**
- Correct imports from `@perfectline-io/testing/mocks`
- Auth guard tests when session imports are detected
- Platform SDK mock setup when SDK imports are detected
- Form submission tests for components with `<form>` or `onSubmit`
- TODO markers for test logic you need to fill in

| Flag | Description |
|---|---|
| `-t, --type <type>` | `unit`, `e2e`, or `both` (default: `both`) |
| `-n, --dry-run` | Print what would be created |
| `-f, --force` | Overwrite existing test files |
| `-v, --verbose` | Show dependency graph and pattern details |
| `-i, --include <glob>` | Glob pattern to limit scan scope |

### `pf test:audit <app-path>`

Compare existing tests against testable code and report coverage gaps.

```bash
pf test:audit apps/perfectideas
```

Outputs a table showing coverage by target type (API routes, pages, components, etc.) and lists all untested files sorted by priority (API routes and middleware first, components last).

**Test detection:** Looks for colocated `__tests__/*.test.ts(x)`, sibling `*.test.ts(x)`, and E2E `e2e/tests/*.spec.ts` files.

---

## CI Composite Actions

Reusable GitHub Actions in `packages/testing/ci/`. Reference them from app workflows.

### `ci-test`

Lint, typecheck, test with coverage, and build.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/ci-test
    with:
      npm-token: ${{ secrets.NPM_TOKEN }}
```

### `e2e-test`

Install Playwright browsers, build the app, optionally start a Stripe listener, run E2E tests, upload artifacts.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/e2e-test
    with:
      npm-token: ${{ secrets.NPM_TOKEN }}
      stripe-enabled: 'true'
      stripe-secret-key: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
```

### `pr-checks`

Validate branch naming convention and PR body sections.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/pr-checks
```

### `health-check`

Run `pf health`, optionally gate on grade, optionally comment on PR.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: ./.github/actions/health-check
    with:
      fail-below: 'D'
      comment-on-pr: 'true'
```

---

## Project Structure

```
packages/testing/
├── package.json
├── tsconfig.json
├── README.md
├── ci/
│   ├── ci-test/action.yml
│   ├── e2e-test/action.yml
│   ├── pr-checks/action.yml
│   └── health-check/action.yml
└── src/
    ├── index.ts                          # Re-exports types
    ├── types.ts                          # TestUser, Collector, ServiceHealth, etc.
    ├── jest/
    │   ├── config.ts                     # createJestConfig()
    │   └── setup.ts                      # Jest environment setup
    ├── playwright/
    │   ├── config.ts                     # createPlaywrightConfig()
    │   ├── fixtures.ts                   # createAuthFixtures()
    │   └── global-setup.ts              # createGlobalSetup(), createGlobalTeardown()
    ├── mocks/
    │   ├── index.ts                      # Re-exports all mocks
    │   ├── session.ts                    # mockSession(), mockUnauthenticated()
    │   ├── platform.ts                   # mockPlatform()
    │   └── next-request.ts              # createMockRequest()
    ├── helpers/
    │   ├── index.ts                      # Re-exports helpers
    │   ├── auth.ts                       # mintSessionToken(), buildAuthCookie()
    │   └── db.ts                         # seedTestUsers()
    └── health/
        ├── index.ts                      # runHealthCheck() orchestrator
        ├── scorer.ts                     # scoreService(), toGrade()
        ├── discovery.ts                  # discoverServices()
        ├── collectors/
        │   ├── index.ts                  # defaultCollectors registry
        │   ├── type-safety.ts
        │   ├── lint.ts
        │   ├── coverage.ts
        │   ├── test-health.ts
        │   ├── dependencies.ts
        │   ├── bundle.ts
        │   └── complexity.ts
        ├── reporters/
        │   ├── terminal.ts              # printTerminalReport()
        │   ├── json.ts                  # writeSnapshot()
        │   └── html.ts                  # generateHtmlReport()
        └── templates/
            └── report.html              # HTML report template
```

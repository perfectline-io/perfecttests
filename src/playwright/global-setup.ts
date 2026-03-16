import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import type { TestUser } from '../types'

export interface GlobalSetupConfig {
  users: TestUser[]
  seedUsers: (db: NeonHttpDatabase, users: TestUser[]) => Promise<void>
  seedData?: (db: NeonHttpDatabase) => Promise<void>
}

/**
 * Create a Playwright globalSetup function that connects to Neon,
 * seeds test users, and optionally seeds additional data.
 */
export function createGlobalSetup(config: GlobalSetupConfig) {
  return async function globalSetup() {
    const DATABASE_URL = process.env.DATABASE_URL
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }

    const client = neon(DATABASE_URL)
    const db = drizzle(client)

    await config.seedUsers(db, config.users)

    if (config.seedData) {
      await config.seedData(db)
    }

    console.warn('[e2e setup] Test data seeded')
  }
}

/**
 * Create a Playwright globalTeardown function with optional cleanup.
 */
export function createGlobalTeardown(cleanup?: () => Promise<void>) {
  return async function globalTeardown() {
    if (cleanup) {
      await cleanup()
    }

    console.warn('[e2e teardown] Cleanup complete')
  }
}

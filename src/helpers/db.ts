import { sql } from 'drizzle-orm'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import type { TestUser } from '../types'

/**
 * Upsert test users into the database.
 * Inserts id, email, name, email_verified; on conflict updates updated_at.
 */
export async function seedTestUsers(
  db: NeonHttpDatabase,
  users: TestUser[],
  tableName = 'users',
) {
  for (const user of users) {
    await db.execute(sql`
      INSERT INTO ${sql.raw(tableName)} (id, email, name, email_verified)
      VALUES (${user.id}, ${user.email}, ${user.name}, NOW())
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    `)
  }
}

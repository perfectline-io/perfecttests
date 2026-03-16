import { encode } from 'next-auth/jwt'
import type { TestUser } from '../types'

const DEFAULT_SALT = 'authjs.session-token'

/**
 * Mint a valid AuthJS v5 JWE session cookie value for a test user.
 * Uses next-auth/jwt encode() with HKDF-SHA256 key derivation.
 */
export async function mintSessionToken(
  user: TestUser,
  secret: string,
  salt: string = DEFAULT_SALT,
): Promise<string> {
  return encode({
    token: {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    secret,
    salt,
    maxAge: 60 * 60 * 24, // 24 hours
  })
}

/**
 * Returns a cookie object compatible with page.context().addCookies([]).
 * Derives domain and secure flag from the base URL.
 * Falls back to process.env.AUTH_SECRET if secret is not provided.
 */
export async function buildAuthCookie(
  user: TestUser,
  baseUrl: string,
  secret?: string,
) {
  const resolvedSecret = secret ?? process.env.AUTH_SECRET!
  const token = await mintSessionToken(user, resolvedSecret)
  const url = new URL(baseUrl)
  return {
    name: 'authjs.session-token',
    value: token,
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax' as const,
  }
}

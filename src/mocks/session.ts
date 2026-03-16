import type { TestUser } from '../types'

interface SessionMockOptions {
  modulePath?: string
  functionName?: string
}

const DEFAULT_MODULE_PATH = '@/lib/session'
const DEFAULT_FUNCTION_NAME = 'getSession'

export function mockSession(
  user: TestUser | null,
  options?: SessionMockOptions,
) {
  const modulePath = options?.modulePath ?? DEFAULT_MODULE_PATH
  const functionName = options?.functionName ?? DEFAULT_FUNCTION_NAME

  const session = user
    ? { user: { id: user.id, email: user.email, name: user.name } }
    : null

  jest.mock(modulePath, () => ({
    [functionName]: jest.fn().mockResolvedValue(session),
  }))
}

export function mockUnauthenticated(options?: SessionMockOptions) {
  mockSession(null, options)
}

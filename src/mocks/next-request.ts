import { NextRequest } from 'next/server'

interface MockRequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  searchParams?: Record<string, string>
  cookies?: Record<string, string>
}

const DEFAULT_BASE_URL = 'http://localhost:3000'

export function createMockRequest(
  path: string,
  options?: MockRequestOptions,
) {
  const url = new URL(path, DEFAULT_BASE_URL)

  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value)
    }
  }

  const headers = new Headers(options?.headers)
  let bodyInit: BodyInit | undefined

  if (options?.body !== undefined) {
    bodyInit = JSON.stringify(options.body)
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }
  }

  const request = new NextRequest(url, {
    method: options?.method ?? 'GET',
    headers,
    body: bodyInit,
  })

  if (options?.cookies) {
    for (const [name, value] of Object.entries(options.cookies)) {
      request.cookies.set(name, value)
    }
  }

  return request
}

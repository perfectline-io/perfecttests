import { readdir, readFile, stat } from 'fs/promises'
import { basename, join } from 'path'
import type { ServiceEntry } from '../types'

const IGNORE_DIRS = new Set(['node_modules', 'dist', '.next', 'context', '.git'])

export async function discoverServices(root: string): Promise<ServiceEntry[]> {
  const configPath = join(root, '.perfectline/health.json')
  if (await fileExists(configPath)) {
    const raw = await readFile(configPath, 'utf8')
    const config = JSON.parse(raw) as { services: ServiceEntry[] }
    return config.services
  }

  const services: ServiceEntry[] = []

  // Check if root itself is a service (running from inside a service directory)
  const rootPkgPath = join(root, 'package.json')
  if (await fileExists(rootPkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(rootPkgPath, 'utf8'))
      const type = await detectServiceType(root, pkg)
      if (type && type !== 'library') {
        services.push({
          name: pkg.name || basename(root),
          path: root,
          type,
        })
        return services
      }
    } catch {
      // Fall through to recursive discovery
    }
  }

  await walkForPackages(root, root, 0, 3, services)
  return services
}

async function walkForPackages(
  dir: string,
  root: string,
  depth: number,
  maxDepth: number,
  out: ServiceEntry[],
): Promise<void> {
  if (depth > maxDepth) return

  let entries: string[]
  try {
    const dirEntries = await readdir(dir, { withFileTypes: true })
    entries = dirEntries
      .filter((e) => e.isDirectory() && !IGNORE_DIRS.has(e.name))
      .map((e) => e.name)
  } catch {
    return
  }

  const pkgPath = join(dir, 'package.json')
  if (depth > 0 && (await fileExists(pkgPath))) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
      const type = await detectServiceType(dir, pkg)
      if (type) {
        out.push({
          name: pkg.name || basename(dir),
          path: dir,
          type,
        })
      }
    } catch {
      // Skip unparseable package.json
    }
  }

  for (const entry of entries) {
    await walkForPackages(join(dir, entry), root, depth + 1, maxDepth, out)
  }
}

export async function detectServiceType(
  dir: string,
  pkg?: Record<string, unknown>,
): Promise<ServiceEntry['type'] | null> {
  if (
    (await fileExists(join(dir, 'next.config.ts'))) ||
    (await fileExists(join(dir, 'next.config.mjs'))) ||
    (await fileExists(join(dir, 'next.config.js')))
  ) {
    return 'nextjs'
  }

  if (!pkg) {
    try {
      pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
    } catch {
      return null
    }
  }

  const deps = (pkg?.dependencies ?? {}) as Record<string, string>
  if (deps.hono) return 'hono'
  if (deps.elysia) return 'elysia'
  if (pkg?.bin) return 'cli'
  return 'library'
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

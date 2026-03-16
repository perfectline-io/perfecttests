import type { Collector, ServiceHealth } from '../types'
import { discoverServices } from './discovery'
import { generateHtmlReport } from './reporters/html'
import { writeSnapshot } from './reporters/json'
import { printTerminalReport } from './reporters/terminal'
import { scoreService } from './scorer'

export interface HealthOptions {
  root: string
  output?: string
  format?: 'terminal' | 'json' | 'html' | 'all'
  skip?: string[]
  verbose?: boolean
  issueCount?: number
  servicePath?: string
}

export async function runHealthCheck(
  collectors: Collector[],
  options: HealthOptions,
): Promise<ServiceHealth[]> {
  const {
    root,
    output = '.perfectline/health-report',
    format = 'all',
    skip = [],
    verbose = false,
    issueCount = 15,
    servicePath,
  } = options

  // 1. Discover services
  let entries = await discoverServices(root)

  // Filter to a single service if specified
  if (servicePath) {
    entries = entries.filter(
      (e) => e.path === servicePath || e.path.endsWith(servicePath) || e.name === servicePath,
    )
  }

  // 2. Filter collectors
  const activeCollectors = collectors.filter((c) => !skip.includes(c.name))

  // 3. Run collectors in parallel per service
  const results: ServiceHealth[] = await Promise.all(
    entries.map(async (entry) => {
      const collectorResults = await Promise.all(
        activeCollectors.map((c) => c.collect(entry.path)),
      )
      return scoreService(entry.name, entry.path, collectorResults)
    }),
  )

  // 4. Report
  if (format === 'terminal' || format === 'all') {
    printTerminalReport(results, { verbose, issueCount })
  }

  if (format === 'json' || format === 'all') {
    await writeSnapshot(results, output)
  }

  if (format === 'html' || format === 'all') {
    const reportPath = await generateHtmlReport(results, output)
    if (format === 'all' || format === 'html') {
      console.log(`Full HTML report: ${reportPath}`)
    }
  }

  return results
}

export { discoverServices } from './discovery'
export { generateHtmlReport } from './reporters/html'
export { writeSnapshot } from './reporters/json'
export { printTerminalReport } from './reporters/terminal'
export { scoreService, toGrade } from './scorer'

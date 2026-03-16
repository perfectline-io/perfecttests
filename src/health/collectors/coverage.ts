import { exec } from 'child_process'
import { readFile } from 'fs/promises'
import { promisify } from 'util'
import type { Collector, CollectorResult, HealthIssue } from '../../types'

const execAsync = promisify(exec)

interface CoverageSummaryTotal {
  lines: { pct: number }
  branches: { pct: number }
  functions: { pct: number }
  statements: { pct: number }
}

interface CoverageSummary {
  total: CoverageSummaryTotal
  [filePath: string]: { lines: { pct: number }; branches: { pct: number }; functions: { pct: number }; statements: { pct: number } }
}

export const coverageCollector: Collector = {
  name: 'coverage',
  dimension: 'Test Coverage',
  weight: 0.2,

  async collect(servicePath: string): Promise<CollectorResult> {
    const issues: HealthIssue[] = []
    const coveragePath = `${servicePath}/coverage/coverage-summary.json`

    let summary: CoverageSummary | null = null

    // Try reading existing coverage data
    try {
      const raw = await readFile(coveragePath, 'utf-8')
      summary = JSON.parse(raw) as CoverageSummary
    } catch {
      // Try running test:coverage
      try {
        await execAsync('bun run test:coverage --ci 2>&1', {
          cwd: servicePath,
          timeout: 120_000,
        })
        const raw = await readFile(coveragePath, 'utf-8')
        summary = JSON.parse(raw) as CoverageSummary
      } catch {
        issues.push({
          severity: 'warning',
          message: 'No test coverage data found',
          fix: 'Add a test:coverage script or run tests with --coverage to generate coverage/coverage-summary.json',
        })

        return {
          dimension: 'Test Coverage',
          rawScore: 0,
          metrics: {
            lines: 0,
            branches: 0,
            functions: 0,
            statements: 0,
          },
          issues,
          timestamp: new Date().toISOString(),
        }
      }
    }

    const total = summary.total
    const lines = total.lines.pct
    const branches = total.branches.pct
    const functions = total.functions.pct
    const statements = total.statements.pct

    const score = Math.round(
      lines * 0.4 + branches * 0.3 + functions * 0.2 + statements * 0.1,
    )

    // Files that are pure types/schemas/re-exports — no runtime logic to test
    const COVERAGE_IGNORE = [
      /\/types\.ts$/,
      /\/types\/.*\.ts$/,
      /\/schema\.ts$/,
      /\/index\.ts$/,
    ]

    // Flag files with low or zero coverage
    for (const [filePath, data] of Object.entries(summary)) {
      if (filePath === 'total') continue
      const relPath = filePath.replace(servicePath + '/', '')

      // Skip type-only, schema, and barrel export files
      if (COVERAGE_IGNORE.some((re) => re.test(relPath))) continue
      const linePct = data.lines.pct

      if (linePct === 0) {
        issues.push({
          severity: 'warning',
          message: `0% test coverage — no tests exist for this file`,
          file: relPath,
          fix: 'Add unit tests for this file',
        })
      } else if (linePct < 30) {
        issues.push({
          severity: 'warning',
          message: `Low test coverage (${linePct}% lines)`,
          file: relPath,
          fix: 'Add more test cases to improve coverage',
        })
      }
    }

    return {
      dimension: 'Test Coverage',
      rawScore: Math.max(0, Math.min(100, score)),
      metrics: {
        lines,
        branches,
        functions,
        statements,
      },
      issues,
      timestamp: new Date().toISOString(),
    }
  },
}

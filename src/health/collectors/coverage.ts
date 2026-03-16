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

    // Flag files with 0% coverage
    for (const [filePath, data] of Object.entries(summary)) {
      if (filePath === 'total') continue
      if (
        data.lines.pct === 0 &&
        data.branches.pct === 0 &&
        data.functions.pct === 0 &&
        data.statements.pct === 0
      ) {
        issues.push({
          severity: 'info',
          message: '0% coverage',
          file: filePath.replace(servicePath + '/', ''),
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

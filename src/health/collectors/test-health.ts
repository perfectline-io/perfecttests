import { readFile } from 'fs/promises'
import { glob } from 'glob'
import type { Collector, CollectorResult, HealthIssue } from '../../types'

export const testHealthCollector: Collector = {
  name: 'test-health',
  dimension: 'Test Health',
  weight: 0.15,

  async collect(servicePath: string): Promise<CollectorResult> {
    const issues: HealthIssue[] = []
    let score = 100

    // Count test files
    const unitTests = await glob('**/*.{test,spec}.{ts,tsx}', {
      cwd: servicePath,
      ignore: ['node_modules/**', 'e2e/**', '.next/**', 'dist/**'],
    })

    const e2eTests = await glob('e2e/**/*.spec.ts', {
      cwd: servicePath,
      ignore: ['node_modules/**'],
    })

    const totalTests = unitTests.length + e2eTests.length

    // Count source files
    const sourceFiles = await glob('{src,app,lib,components}/**/*.{ts,tsx}', {
      cwd: servicePath,
      ignore: [
        'node_modules/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.d.ts',
        '.next/**',
        'dist/**',
      ],
    })

    const sourceCount = sourceFiles.length
    const testRatio = sourceCount > 0 ? totalTests / sourceCount : 0

    // Penalty for zero tests
    if (totalTests === 0) {
      score -= 50
      issues.push({
        severity: 'error',
        message: 'No test files found',
        fix: 'Add unit tests (*.test.ts) or E2E tests (e2e/*.spec.ts)',
      })
    } else if (testRatio < 0.1) {
      score -= 30
      issues.push({
        severity: 'warning',
        message: `Very low test-to-code ratio: ${testRatio.toFixed(2)} (${totalTests} tests / ${sourceCount} source files)`,
        fix: 'Add more tests to improve coverage',
      })
    } else if (testRatio < 0.3) {
      score -= 15
      issues.push({
        severity: 'warning',
        message: `Low test-to-code ratio: ${testRatio.toFixed(2)} (${totalTests} tests / ${sourceCount} source files)`,
        fix: 'Consider adding more tests',
      })
    } else if (testRatio < 0.5) {
      score -= 5
      issues.push({
        severity: 'info',
        message: `Test-to-code ratio: ${testRatio.toFixed(2)} (${totalTests} tests / ${sourceCount} source files)`,
      })
    }

    // Parse Playwright report for flaky tests
    let flakyCount = 0
    try {
      const reportPath = `${servicePath}/playwright-report/report.json`
      const raw = await readFile(reportPath, 'utf-8')
      const report = JSON.parse(raw)
      const suites = report.suites ?? []

      const findFlaky = (items: Array<{ status?: string; title?: string; suites?: unknown[]; specs?: unknown[] }>): void => {
        for (const item of items) {
          if (item.status === 'flaky') {
            flakyCount++
            issues.push({
              severity: 'warning',
              message: `Flaky test: ${item.title}`,
              rule: 'no-flaky-tests',
            })
          }
          if (Array.isArray(item.suites)) findFlaky(item.suites as typeof items)
          if (Array.isArray(item.specs)) findFlaky(item.specs as typeof items)
        }
      }

      findFlaky(suites)
    } catch {
      // No Playwright report — that's fine
    }

    const flakyPenalty = flakyCount * 5
    score -= flakyPenalty

    score = Math.max(0, Math.min(100, score))

    return {
      dimension: 'Test Health',
      rawScore: score,
      metrics: {
        unitTests: unitTests.length,
        e2eTests: e2eTests.length,
        totalTests,
        sourceFiles: sourceCount,
        testRatio: parseFloat(testRatio.toFixed(3)),
        flakyTests: flakyCount,
      },
      issues,
      timestamp: new Date().toISOString(),
    }
  },
}

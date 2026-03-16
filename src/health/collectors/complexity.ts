import { exec } from 'child_process'
import { readFile } from 'fs/promises'
import { promisify } from 'util'
import { glob } from 'glob'
import type { Collector, CollectorResult, HealthIssue } from '../../types'

const execAsync = promisify(exec)

const FILE_SIZE_THRESHOLD = 300
const AVG_SIZE_THRESHOLD = 200

export const complexityCollector: Collector = {
  name: 'complexity',
  dimension: 'Code Complexity',
  weight: 0.15,

  async collect(servicePath: string): Promise<CollectorResult> {
    const issues: HealthIssue[] = []
    let score = 100

    // Find source files
    const sourceFiles = await glob('{src,app,lib,components}/**/*.{ts,tsx}', {
      cwd: servicePath,
      absolute: true,
      ignore: [
        'node_modules/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.d.ts',
        '.next/**',
        'dist/**',
      ],
    })

    if (sourceFiles.length === 0) {
      return {
        dimension: 'Code Complexity',
        rawScore: 100,
        metrics: { totalFiles: 0, avgLines: 0, oversizedFiles: 0, circularDeps: 0 },
        issues: [{ severity: 'info', message: 'No source files found to analyze' }],
        timestamp: new Date().toISOString(),
      }
    }

    // Compute line counts
    let totalLines = 0
    let oversizedCount = 0
    const oversizedFiles: Array<{ file: string; lines: number }> = []

    for (const file of sourceFiles) {
      try {
        const content = await readFile(file, 'utf-8')
        const lineCount = content.split('\n').length
        totalLines += lineCount

        if (lineCount > FILE_SIZE_THRESHOLD) {
          oversizedCount++
          oversizedFiles.push({
            file: file.replace(servicePath + '/', ''),
            lines: lineCount,
          })
        }
      } catch {
        // Skip unreadable files
      }
    }

    const avgLines = Math.round(totalLines / sourceFiles.length)

    // Penalty for oversized files: -5 each (max -30)
    const oversizedPenalty = Math.min(oversizedCount * 5, 30)
    score -= oversizedPenalty

    for (const f of oversizedFiles.slice(0, 10)) {
      issues.push({
        severity: 'warning',
        message: `File exceeds ${FILE_SIZE_THRESHOLD} lines: ${f.file} (${f.lines} lines)`,
        file: f.file,
        fix: 'Split into smaller, focused modules',
      })
    }

    if (oversizedFiles.length > 10) {
      issues.push({
        severity: 'info',
        message: `${oversizedFiles.length - 10} additional oversized files omitted`,
      })
    }

    // Penalty for high average file size
    let avgPenalty = 0
    if (avgLines > AVG_SIZE_THRESHOLD) {
      avgPenalty = 10
      score -= avgPenalty
      issues.push({
        severity: 'warning',
        message: `Average file size is ${avgLines} lines (threshold: ${AVG_SIZE_THRESHOLD})`,
        fix: 'Refactor large files to reduce average complexity',
      })
    }

    // Check for circular dependencies via madge (optional)
    let circularCount = 0
    try {
      const { stdout } = await execAsync('npx madge --circular --json src/ 2>/dev/null', {
        cwd: servicePath,
        timeout: 30_000,
      })

      const circular: string[][] = JSON.parse(stdout)
      circularCount = circular.length

      for (const chain of circular.slice(0, 5)) {
        issues.push({
          severity: 'warning',
          message: `Circular dependency: ${chain.join(' → ')}`,
          rule: 'no-circular-deps',
          fix: 'Break the circular dependency by extracting shared types or using dependency injection',
        })
      }

      if (circular.length > 5) {
        issues.push({
          severity: 'info',
          message: `${circular.length - 5} additional circular dependency chains omitted`,
        })
      }
    } catch {
      issues.push({
        severity: 'info',
        message: 'madge not available — skipping circular dependency check',
        fix: 'Install madge globally for circular dependency detection: bun add -g madge',
      })
    }

    // Penalty for circular deps: -10 each (max -20)
    const circularPenalty = Math.min(circularCount * 10, 20)
    score -= circularPenalty

    score = Math.max(0, Math.min(100, score))

    return {
      dimension: 'Code Complexity',
      rawScore: score,
      metrics: {
        totalFiles: sourceFiles.length,
        totalLines,
        avgLines,
        oversizedFiles: oversizedCount,
        circularDeps: circularCount,
        oversizedPenalty,
        avgPenalty,
        circularPenalty,
      },
      issues,
      timestamp: new Date().toISOString(),
    }
  },
}

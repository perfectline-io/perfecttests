import { exec } from 'child_process'
import { readFile } from 'fs/promises'
import { promisify } from 'util'
import { glob } from 'glob'
import type { Collector, CollectorResult, HealthIssue } from '../../types'

const execAsync = promisify(exec)

const STRICT_FLAGS = [
  'strict',
  'noImplicitAny',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
] as const

export const typeSafetyCollector: Collector = {
  name: 'type-safety',
  dimension: 'Type Safety',
  weight: 0.2,

  async collect(servicePath: string): Promise<CollectorResult> {
    const issues: HealthIssue[] = []
    let score = 100

    // Run tsc --noEmit
    let tscErrors = 0
    try {
      await execAsync('npx tsc --noEmit --pretty false 2>&1', {
        cwd: servicePath,
      })
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string }
      const output = (error.stdout ?? '') + (error.stderr ?? '')
      const errorLines = output
        .split('\n')
        .filter((line) => /\(\d+,\d+\): error TS/.test(line))
      tscErrors = errorLines.length

      for (const line of errorLines.slice(0, 10)) {
        const match = line.match(/^(.+?)\((\d+),\d+\): error (TS\d+): (.+)$/)
        if (match) {
          issues.push({
            severity: 'error',
            message: match[4],
            file: match[1],
            line: parseInt(match[2], 10),
            rule: match[3],
          })
        }
      }

      if (errorLines.length > 10) {
        issues.push({
          severity: 'info',
          message: `${errorLines.length - 10} additional tsc errors omitted`,
        })
      }
    }

    const tscPenalty = Math.min(tscErrors * 5, 40)
    score -= tscPenalty

    // Count `any` usage in source files
    let anyCount = 0
    try {
      const files = await glob(
        '{src,app,lib,components}/**/*.{ts,tsx}',
        { cwd: servicePath, absolute: true },
      )

      for (const file of files) {
        const content = await readFile(file, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // Skip comment lines
          if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue
          // Remove inline comments and string literals before matching
          const noComments = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
          const noStrings = noComments
            .replace(/"(?:[^"\\]|\\.)*"/g, '""')
            .replace(/'(?:[^'\\]|\\.)*'/g, "''")
            .replace(/`(?:[^`\\]|\\.)*`/g, '``')
          // Match `any` only in type positions: `: any`, `<any>`, `as any`, `any[]`, `any,`, `any)`
          const matches = noStrings.match(/(?::|\bas\b|<|,|\||\&)\s*any\b|any\s*[>\[\],\);\|&]/g)
          if (matches) {
            for (const _ of matches) {
              anyCount++
              issues.push({
                severity: 'warning',
                message: `Explicit \`any\` usage`,
                file: file.replace(servicePath + '/', ''),
                line: i + 1,
                rule: 'no-any',
              })
            }
          }
        }
      }
    } catch {
      issues.push({
        severity: 'info',
        message: 'Could not scan source files for `any` usage',
      })
    }

    const anyPenalty = Math.min(anyCount * 2, 30)
    score -= anyPenalty

    // Check tsconfig strict flags
    let missingFlags = 0
    try {
      const tsconfigRaw = await readFile(
        `${servicePath}/tsconfig.json`,
        'utf-8',
      )
      // Strip comments for JSON parsing
      const stripped = tsconfigRaw.replace(
        /\/\*[\s\S]*?\*\/|\/\/.*/g,
        '',
      )
      const tsconfig = JSON.parse(stripped)
      const compilerOptions = tsconfig.compilerOptions ?? {}

      if (compilerOptions.strict === true) {
        // strict enables all sub-flags
        missingFlags = 0
      } else {
        for (const flag of STRICT_FLAGS) {
          if (flag === 'strict') {
            if (!compilerOptions.strict) {
              missingFlags++
              issues.push({
                severity: 'warning',
                message: `Missing tsconfig flag: ${flag}`,
                file: 'tsconfig.json',
                rule: 'strict-mode',
                fix: `Add "${flag}: true" to compilerOptions`,
              })
            }
          } else if (!compilerOptions[flag] && !compilerOptions.strict) {
            missingFlags++
            issues.push({
              severity: 'warning',
              message: `Missing tsconfig flag: ${flag}`,
              file: 'tsconfig.json',
              rule: 'strict-mode',
              fix: `Add "${flag}: true" to compilerOptions`,
            })
          }
        }
      }
    } catch {
      missingFlags = STRICT_FLAGS.length
      issues.push({
        severity: 'warning',
        message: 'Could not read tsconfig.json',
        file: 'tsconfig.json',
      })
    }

    const strictPenalty = Math.min(missingFlags * 5, 20)
    score -= strictPenalty

    score = Math.max(0, Math.min(100, score))

    return {
      dimension: 'Type Safety',
      rawScore: score,
      metrics: {
        tscErrors,
        anyUsages: anyCount,
        missingStrictFlags: missingFlags,
        tscPenalty,
        anyPenalty,
        strictPenalty,
      },
      issues,
      timestamp: new Date().toISOString(),
    }
  },
}

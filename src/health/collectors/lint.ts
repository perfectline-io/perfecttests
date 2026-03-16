import { exec } from 'child_process'
import { access } from 'fs/promises'
import { promisify } from 'util'
import type { Collector, CollectorResult, HealthIssue } from '../../types'

const execAsync = promisify(exec)

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

type LinterKind = 'biome' | 'eslint' | null

async function detectLinter(servicePath: string): Promise<LinterKind> {
  if (await fileExists(`${servicePath}/biome.json`)) return 'biome'
  if (await fileExists(`${servicePath}/biome.jsonc`)) return 'biome'
  if (await fileExists(`${servicePath}/eslint.config.mjs`)) return 'eslint'
  if (await fileExists(`${servicePath}/eslint.config.js`)) return 'eslint'
  if (await fileExists(`${servicePath}/.eslintrc.json`)) return 'eslint'
  if (await fileExists(`${servicePath}/.eslintrc.js`)) return 'eslint'
  if (await fileExists(`${servicePath}/.eslintrc.yml`)) return 'eslint'
  return null
}

interface LintCounts {
  errors: number
  warnings: number
  issues: HealthIssue[]
}

async function runBiome(servicePath: string): Promise<LintCounts> {
  const issues: HealthIssue[] = []
  let errors = 0
  let warnings = 0

  try {
    const { stdout } = await execAsync(
      'npx @biomejs/biome lint --reporter=json . 2>/dev/null',
      { cwd: servicePath, maxBuffer: 10 * 1024 * 1024 },
    )
    const result = JSON.parse(stdout)
    const diagnostics = result.diagnostics ?? []

    for (const d of diagnostics) {
      const severity = d.severity === 'error' ? 'error' : 'warning'
      if (severity === 'error') errors++
      else warnings++

      issues.push({
        severity,
        message: d.message ?? d.description ?? 'Lint issue',
        file: d.location?.path,
        line: d.location?.span?.start?.line,
        rule: d.category,
      })
    }
  } catch (err: unknown) {
    const error = err as { stdout?: string }
    // Biome exits non-zero when there are lint issues
    try {
      const result = JSON.parse(error.stdout ?? '{}')
      const diagnostics = result.diagnostics ?? []

      for (const d of diagnostics) {
        const severity = d.severity === 'error' ? 'error' : 'warning'
        if (severity === 'error') errors++
        else warnings++

        issues.push({
          severity,
          message: d.message ?? d.description ?? 'Lint issue',
          file: d.location?.path,
          line: d.location?.span?.start?.line,
          rule: d.category,
        })
      }
    } catch {
      issues.push({
        severity: 'info',
        message: 'Biome produced non-JSON output; could not parse results',
      })
    }
  }

  return { errors, warnings, issues }
}

async function runEslint(servicePath: string): Promise<LintCounts> {
  const issues: HealthIssue[] = []
  let errors = 0
  let warnings = 0

  try {
    const { stdout } = await execAsync(
      'npx eslint --format json . 2>/dev/null',
      { cwd: servicePath, maxBuffer: 10 * 1024 * 1024 },
    )
    const results: Array<{
      filePath: string
      messages: Array<{
        severity: number
        message: string
        line: number
        ruleId: string | null
      }>
    }> = JSON.parse(stdout)

    for (const file of results) {
      for (const msg of file.messages) {
        const severity = msg.severity === 2 ? 'error' : 'warning'
        if (severity === 'error') errors++
        else warnings++

        issues.push({
          severity,
          message: msg.message,
          file: file.filePath.replace(servicePath + '/', ''),
          line: msg.line,
          rule: msg.ruleId ?? undefined,
        })
      }
    }
  } catch (err: unknown) {
    const error = err as { stdout?: string }
    // ESLint exits non-zero when there are errors
    try {
      const results = JSON.parse(error.stdout ?? '[]')
      for (const file of results) {
        for (const msg of file.messages) {
          const severity = msg.severity === 2 ? 'error' : 'warning'
          if (severity === 'error') errors++
          else warnings++

          issues.push({
            severity,
            message: msg.message,
            file: file.filePath.replace(servicePath + '/', ''),
            line: msg.line,
            rule: msg.ruleId ?? undefined,
          })
        }
      }
    } catch {
      issues.push({
        severity: 'info',
        message: 'ESLint produced non-JSON output; could not parse results',
      })
    }
  }

  return { errors, warnings, issues }
}

export const lintCollector: Collector = {
  name: 'lint',
  dimension: 'Lint Compliance',
  weight: 0.1,

  async collect(servicePath: string): Promise<CollectorResult> {
    const issues: HealthIssue[] = []
    let score = 100

    const linter = await detectLinter(servicePath)

    if (!linter) {
      score -= 30
      issues.push({
        severity: 'warning',
        message: 'No linter configured. Consider adding Biome or ESLint.',
        fix: 'Add biome.json or eslint.config.mjs to the project root',
      })

      return {
        dimension: 'Lint Compliance',
        rawScore: Math.max(0, score),
        metrics: { linter: 'none', errors: 0, warnings: 0 },
        issues,
        timestamp: new Date().toISOString(),
      }
    }

    const counts =
      linter === 'biome'
        ? await runBiome(servicePath)
        : await runEslint(servicePath)

    issues.push(...counts.issues)

    const errorPenalty = Math.min(counts.errors * 3, 30)
    const warningPenalty = Math.min(counts.warnings * 1, 20)
    score -= errorPenalty + warningPenalty

    score = Math.max(0, Math.min(100, score))

    return {
      dimension: 'Lint Compliance',
      rawScore: score,
      metrics: {
        linter,
        errors: counts.errors,
        warnings: counts.warnings,
        errorPenalty,
        warningPenalty,
      },
      issues,
      timestamp: new Date().toISOString(),
    }
  },
}

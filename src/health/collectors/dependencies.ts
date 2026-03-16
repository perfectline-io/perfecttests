import { exec } from 'child_process'
import { promisify } from 'util'
import type { Collector, CollectorResult, HealthIssue } from '../../types'

const execAsync = promisify(exec)

export const dependenciesCollector: Collector = {
  name: 'dependencies',
  dimension: 'Dependency Health',
  weight: 0.1,

  async collect(servicePath: string): Promise<CollectorResult> {
    const issues: HealthIssue[] = []
    let score = 100

    let critical = 0
    let high = 0
    let moderate = 0
    let low = 0

    // Run bun audit (bun pm audit is not yet stable — try npm audit as fallback)
    try {
      const { stdout } = await execAsync('bun pm audit 2>&1 || npm audit --json 2>/dev/null', {
        cwd: servicePath,
        timeout: 30_000,
      })

      // Try parsing as JSON (npm audit format)
      try {
        const auditResult = JSON.parse(stdout)
        const vulnerabilities = auditResult.vulnerabilities ?? auditResult.advisories ?? {}

        for (const vuln of Object.values(vulnerabilities) as Array<{ severity?: string; name?: string; title?: string }>) {
          switch (vuln.severity) {
            case 'critical':
              critical++
              break
            case 'high':
              high++
              break
            case 'moderate':
              moderate++
              break
            case 'low':
              low++
              break
          }
        }
      } catch {
        // Parse text output for vulnerability counts
        const criticalMatch = stdout.match(/(\d+)\s+critical/i)
        const highMatch = stdout.match(/(\d+)\s+high/i)
        const moderateMatch = stdout.match(/(\d+)\s+moderate/i)
        const lowMatch = stdout.match(/(\d+)\s+low/i)

        if (criticalMatch) critical = parseInt(criticalMatch[1], 10)
        if (highMatch) high = parseInt(highMatch[1], 10)
        if (moderateMatch) moderate = parseInt(moderateMatch[1], 10)
        if (lowMatch) low = parseInt(lowMatch[1], 10)
      }
    } catch {
      issues.push({
        severity: 'info',
        message: 'Could not run dependency audit (bun pm audit / npm audit)',
      })
    }

    if (critical > 0) {
      issues.push({
        severity: 'error',
        message: `${critical} critical vulnerability${critical > 1 ? 'ies' : 'y'} found`,
        fix: 'Run `bun update` or manually resolve critical vulnerabilities',
      })
    }
    if (high > 0) {
      issues.push({
        severity: 'error',
        message: `${high} high severity vulnerability${high > 1 ? 'ies' : 'y'} found`,
        fix: 'Run `bun update` to resolve high severity vulnerabilities',
      })
    }
    if (moderate > 0) {
      issues.push({
        severity: 'warning',
        message: `${moderate} moderate vulnerability${moderate > 1 ? 'ies' : 'y'} found`,
      })
    }

    const vulnPenalty = critical * 20 + high * 10 + moderate * 3
    score -= vulnPenalty

    // Check for outdated packages
    let majorOutdated = 0
    try {
      const { stdout } = await execAsync('bun outdated 2>&1', {
        cwd: servicePath,
        timeout: 30_000,
      })

      // Parse bun outdated text output — look for major version bumps
      const lines = stdout.split('\n')
      for (const line of lines) {
        // Typical format: "package  current  latest"
        const versionMatch = line.match(/(\S+)\s+(\d+)\.\d+\.\d+\s+(\d+)\.\d+\.\d+/)
        if (versionMatch) {
          const currentMajor = parseInt(versionMatch[2], 10)
          const latestMajor = parseInt(versionMatch[3], 10)
          if (latestMajor > currentMajor) {
            majorOutdated++
            issues.push({
              severity: 'warning',
              message: `Major update available for ${versionMatch[1]}: ${versionMatch[2]}.x → ${versionMatch[3]}.x`,
              fix: `Run \`bun update ${versionMatch[1]}\``,
            })
          }
        }
      }
    } catch {
      issues.push({
        severity: 'info',
        message: 'Could not check for outdated packages',
      })
    }

    const outdatedPenalty = Math.min(majorOutdated * 4, 20)
    score -= outdatedPenalty

    // Optional: run knip for unused dependencies
    try {
      const { stdout } = await execAsync('npx knip --reporter json 2>/dev/null', {
        cwd: servicePath,
        timeout: 60_000,
      })

      const knipResult = JSON.parse(stdout)
      const unusedDeps: string[] = knipResult.dependencies ?? []
      const unusedDevDeps: string[] = knipResult.devDependencies ?? []

      for (const dep of [...unusedDeps, ...unusedDevDeps]) {
        issues.push({
          severity: 'info',
          message: `Potentially unused dependency: ${dep}`,
          fix: `Remove with \`bun remove ${dep}\``,
        })
      }
    } catch {
      // knip not available — that's fine
    }

    score = Math.max(0, Math.min(100, score))

    return {
      dimension: 'Dependency Health',
      rawScore: score,
      metrics: {
        critical,
        high,
        moderate,
        low,
        majorOutdated,
        vulnPenalty,
        outdatedPenalty,
      },
      issues,
      timestamp: new Date().toISOString(),
    }
  },
}

import type { CollectorResult, ServiceHealth } from '../types'

const DEFAULT_WEIGHTS: Record<string, number> = {
  'Type Safety': 0.20,
  'Lint Compliance': 0.15,
  'Test Coverage': 0.20,
  'Test Health': 0.10,
  'Dependency Health': 0.15,
  'Bundle Health': 0.10,
  'Code Complexity': 0.10,
}

export function scoreService(
  service: string,
  path: string,
  results: CollectorResult[],
): ServiceHealth {
  let compositeScore = 0
  for (const result of results) {
    const weight = DEFAULT_WEIGHTS[result.dimension] ?? 0.10
    compositeScore += result.rawScore * weight
  }
  compositeScore = Math.round(compositeScore)

  const issueCount = { error: 0, warning: 0, info: 0 }
  for (const result of results) {
    for (const issue of result.issues) {
      issueCount[issue.severity]++
    }
  }

  return {
    service,
    path,
    dimensions: results,
    compositeScore,
    grade: toGrade(compositeScore),
    issueCount,
    timestamp: new Date().toISOString(),
  }
}

export function toGrade(score: number): string {
  if (score >= 95) return 'A+'
  if (score >= 90) return 'A'
  if (score >= 85) return 'A-'
  if (score >= 80) return 'B+'
  if (score >= 75) return 'B'
  if (score >= 70) return 'B-'
  if (score >= 65) return 'C+'
  if (score >= 60) return 'C'
  if (score >= 55) return 'C-'
  if (score >= 50) return 'D'
  return 'F'
}

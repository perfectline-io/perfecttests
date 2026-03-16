import { readFile, stat } from 'fs/promises'
import { glob } from 'glob'
import type { Collector, CollectorResult, HealthIssue } from '../../types'

const CHUNK_SIZE_WARN_KB = 250
const TOTAL_BUNDLE_WARN_KB = 1024

export const bundleCollector: Collector = {
  name: 'bundle',
  dimension: 'Bundle Health',
  weight: 0.1,

  async collect(servicePath: string): Promise<CollectorResult> {
    const issues: HealthIssue[] = []

    // Check if this is a Next.js app
    const nextConfigs = await glob('next.config.*', {
      cwd: servicePath,
    })

    if (nextConfigs.length === 0) {
      return {
        dimension: 'Bundle Health',
        rawScore: 100,
        metrics: { applicable: 'no' },
        issues: [],
        timestamp: new Date().toISOString(),
      }
    }

    // Analyze .next/static/chunks
    const chunkFiles = await glob('.next/static/chunks/**/*.js', {
      cwd: servicePath,
      absolute: true,
    })

    if (chunkFiles.length === 0) {
      issues.push({
        severity: 'info',
        message: 'No build output found in .next/static/chunks. Run `bun run build` first.',
        fix: 'Run `bun run build` to generate the production bundle',
      })

      return {
        dimension: 'Bundle Health',
        rawScore: 100,
        metrics: { applicable: 'yes', chunks: 0, totalSizeKB: 0 },
        issues,
        timestamp: new Date().toISOString(),
      }
    }

    let score = 100
    let totalSizeBytes = 0
    let oversizedChunks = 0

    for (const chunkFile of chunkFiles) {
      try {
        const fileStat = await stat(chunkFile)
        const sizeKB = fileStat.size / 1024
        totalSizeBytes += fileStat.size

        if (sizeKB > CHUNK_SIZE_WARN_KB) {
          oversizedChunks++
          issues.push({
            severity: 'warning',
            message: `Oversized chunk: ${chunkFile.replace(servicePath + '/', '')} (${Math.round(sizeKB)}KB > ${CHUNK_SIZE_WARN_KB}KB)`,
            file: chunkFile.replace(servicePath + '/', ''),
            fix: 'Consider code splitting or dynamic imports to reduce chunk size',
          })
        }
      } catch {
        // Skip files we can't stat
      }
    }

    const totalSizeKB = Math.round(totalSizeBytes / 1024)

    // Chunk penalty: -10 per oversized chunk
    const chunkPenalty = oversizedChunks * 10
    score -= chunkPenalty

    // Total bundle size penalty
    let totalPenalty = 0
    if (totalSizeKB > TOTAL_BUNDLE_WARN_KB * 2) {
      totalPenalty = 20
      issues.push({
        severity: 'error',
        message: `Total bundle size is very large: ${totalSizeKB}KB (> ${TOTAL_BUNDLE_WARN_KB * 2}KB)`,
        fix: 'Audit dependencies and use dynamic imports to reduce total bundle size',
      })
    } else if (totalSizeKB > TOTAL_BUNDLE_WARN_KB) {
      totalPenalty = 10
      issues.push({
        severity: 'warning',
        message: `Total bundle size is large: ${totalSizeKB}KB (> ${TOTAL_BUNDLE_WARN_KB}KB)`,
        fix: 'Consider reducing bundle size with tree-shaking and dynamic imports',
      })
    }
    score -= totalPenalty

    // Also check build manifest for route sizes if available
    try {
      const manifestPath = `${servicePath}/.next/build-manifest.json`
      const raw = await readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(raw)
      const pages = manifest.pages ?? {}
      const pageCount = Object.keys(pages).length

      return {
        dimension: 'Bundle Health',
        rawScore: Math.max(0, Math.min(100, score)),
        metrics: {
          applicable: 'yes',
          chunks: chunkFiles.length,
          oversizedChunks,
          totalSizeKB,
          pages: pageCount,
          chunkPenalty,
          totalPenalty,
        },
        issues,
        timestamp: new Date().toISOString(),
      }
    } catch {
      // No build manifest — return without page count
    }

    return {
      dimension: 'Bundle Health',
      rawScore: Math.max(0, Math.min(100, score)),
      metrics: {
        applicable: 'yes',
        chunks: chunkFiles.length,
        oversizedChunks,
        totalSizeKB,
        chunkPenalty,
        totalPenalty,
      },
      issues,
      timestamp: new Date().toISOString(),
    }
  },
}

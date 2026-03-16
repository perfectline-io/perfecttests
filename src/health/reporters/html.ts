import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { HealthSnapshot, ServiceHealth } from '../../types'

export async function generateHtmlReport(
  services: ServiceHealth[],
  outputDir: string,
): Promise<string> {
  const templatePath = join(__dirname, '../templates/report.html')
  const template = await readFile(templatePath, 'utf8')

  const snapshots = await loadSnapshots(join(outputDir, 'snapshots'))

  const data = JSON.stringify({
    services,
    generated: new Date().toISOString(),
    history: snapshots,
  })

  const html = template.replace(
    '<!-- __HEALTH_DATA__ -->',
    `<script>window.__HEALTH_DATA__ = ${data}</script>`,
  )

  const outputPath = join(outputDir, 'index.html')
  await mkdir(outputDir, { recursive: true })
  await writeFile(outputPath, html)

  return outputPath
}

async function loadSnapshots(snapshotDir: string): Promise<HealthSnapshot[]> {
  try {
    const files = await readdir(snapshotDir)
    const jsonFiles = files
      .filter((f) => f.endsWith('.json') && f !== 'latest.json')
      .sort()

    const snapshots: HealthSnapshot[] = []
    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(snapshotDir, file), 'utf8')
        snapshots.push(JSON.parse(raw))
      } catch {
        // Skip corrupted snapshot files
      }
    }
    return snapshots
  } catch {
    return []
  }
}

import { exec } from 'child_process'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import type { HealthSnapshot, ServiceHealth } from '../../types'

export async function writeSnapshot(
  services: ServiceHealth[],
  outputDir: string,
): Promise<void> {
  const snapshot: HealthSnapshot = {
    generated: new Date().toISOString(),
    gitSha: await execTrimmed('git rev-parse HEAD'),
    gitBranch: await execTrimmed('git branch --show-current'),
    services,
  }

  const snapshotDir = join(outputDir, 'snapshots')
  await mkdir(snapshotDir, { recursive: true })

  const filename = new Date().toISOString().split('T')[0] + '.json'
  const content = JSON.stringify(snapshot, null, 2)

  await writeFile(join(snapshotDir, filename), content)
  await writeFile(join(snapshotDir, 'latest.json'), content)
}

function execTrimmed(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout) => {
      resolve(error ? '' : stdout.trim())
    })
  })
}

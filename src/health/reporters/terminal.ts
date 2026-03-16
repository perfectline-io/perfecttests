import type { HealthIssue, ServiceHealth } from '../../types'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const WHITE = '\x1b[37m'

export interface TerminalReportOptions {
  verbose?: boolean
  issueCount?: number
}

export function printTerminalReport(
  services: ServiceHealth[],
  options: TerminalReportOptions = {},
): void {
  const { verbose = false, issueCount: maxIssues = 15 } = options

  console.log('')
  console.log(`${BOLD}PerfectLine Code Health Report${RESET}`)
  console.log('='.repeat(30))
  console.log(`${DIM}Generated: ${new Date().toISOString()}${RESET}`)
  console.log('')

  if (verbose && services.length === 1) {
    printVerboseService(services[0])
    return
  }

  printSummaryTable(services)
  printTopIssues(services, maxIssues)
}

function gradeColor(grade: string): string {
  if (grade === 'F' || grade === 'D') return RED
  if (grade.startsWith('C')) return YELLOW
  return GREEN
}

function printSummaryTable(services: ServiceHealth[]): void {
  const dimensions = collectDimensionNames(services)
  const nameWidth = Math.max(16, ...services.map((s) => s.service.length + 2))
  const colWidth = 10

  // Header
  let header = `${BOLD}${'Service'.padEnd(nameWidth)}${'Grade'.padEnd(8)}`
  for (const dim of dimensions) {
    header += abbreviate(dim).padEnd(colWidth)
  }
  header += RESET
  console.log(header)
  console.log(DIM + '─'.repeat(nameWidth + 8 + dimensions.length * colWidth) + RESET)

  // Rows
  for (const service of services) {
    const gc = gradeColor(service.grade)
    let row = `${WHITE}${service.service.padEnd(nameWidth)}${RESET}`
    row += `${gc}${BOLD}${service.grade.padEnd(8)}${RESET}`

    for (const dim of dimensions) {
      const result = service.dimensions.find((d) => d.dimension === dim)
      const score = result ? String(result.rawScore) : '—'
      const sc = result ? scoreColor(result.rawScore) : DIM
      row += `${sc}${score.padEnd(colWidth)}${RESET}`
    }

    console.log(row)
  }

  console.log('')
}

function printTopIssues(services: ServiceHealth[], max: number): void {
  const allIssues: { service: string; issue: HealthIssue }[] = []
  for (const service of services) {
    for (const dim of service.dimensions) {
      for (const issue of dim.issues) {
        allIssues.push({ service: service.service, issue })
      }
    }
  }

  // Sort: errors first, then warnings, then info
  const severityOrder = { error: 0, warning: 1, info: 2 }
  allIssues.sort((a, b) => severityOrder[a.issue.severity] - severityOrder[b.issue.severity])

  const shown = allIssues.slice(0, max)
  const total = allIssues.length

  console.log(`${BOLD}Top Issues (${shown.length} of ${total}):${RESET}`)

  for (const { service, issue } of shown) {
    const tag = severityTag(issue.severity)
    const location = issue.file ? ` ${DIM}${issue.file}${issue.line ? `:${issue.line}` : ''}${RESET}` : ''
    console.log(`  ${tag}  ${WHITE}${service.padEnd(18)}${RESET}${issue.message}${location}`)
  }

  console.log('')
}

function printVerboseService(service: ServiceHealth): void {
  const gc = gradeColor(service.grade)
  console.log(`${BOLD}${service.service}${RESET} — Code Health Detail`)
  console.log('='.repeat(40))
  console.log(`Overall: ${gc}${BOLD}${service.grade}${RESET} (${service.compositeScore}/100)`)
  console.log('')

  for (const dim of service.dimensions) {
    const bar = progressBar(dim.rawScore, 20)
    const sc = scoreColor(dim.rawScore)
    console.log(`${BOLD}${dim.dimension}${RESET} ${sc}${bar} ${dim.rawScore}/100${RESET}`)

    for (const issue of dim.issues) {
      const icon = issue.severity === 'error' ? `${RED}✗` : issue.severity === 'warning' ? `${YELLOW}⚠` : `${GREEN}✓`
      console.log(`  ${icon} ${issue.message}${RESET}`)
      if (issue.fix) {
        console.log(`    ${DIM}Fix: ${issue.fix}${RESET}`)
      }
    }

    // Show metrics
    for (const [key, value] of Object.entries(dim.metrics)) {
      console.log(`  ${DIM}${key}: ${value}${RESET}`)
    }

    console.log('')
  }
}

function progressBar(score: number, width: number): string {
  const filled = Math.round((score / 100) * width)
  const empty = width - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

function scoreColor(score: number): string {
  if (score >= 75) return GREEN
  if (score >= 55) return YELLOW
  return RED
}

function severityTag(severity: HealthIssue['severity']): string {
  switch (severity) {
    case 'error':
      return `${RED}${BOLD}ERROR ${RESET}`
    case 'warning':
      return `${YELLOW}WARN  ${RESET}`
    case 'info':
      return `${CYAN}INFO  ${RESET}`
  }
}

function abbreviate(dimension: string): string {
  const map: Record<string, string> = {
    'Type Safety': 'TypeSafe',
    'Lint Compliance': 'Lint',
    'Test Coverage': 'Coverage',
    'Test Health': 'TestH.',
    'Dependency Health': 'Deps',
    'Bundle Health': 'Bundle',
    'Code Complexity': 'Complex.',
  }
  return map[dimension] ?? dimension.slice(0, 8)
}

function collectDimensionNames(services: ServiceHealth[]): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const service of services) {
    for (const dim of service.dimensions) {
      if (!seen.has(dim.dimension)) {
        seen.add(dim.dimension)
        ordered.push(dim.dimension)
      }
    }
  }
  return ordered
}

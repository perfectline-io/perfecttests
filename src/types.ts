export interface TestUser {
  id: string
  email: string
  name: string
  role?: string
  tier?: string
}

export interface TestConfig {
  appName: string
  baseUrl?: string
  databaseUrl?: string
}

export interface CollectorResult {
  dimension: string
  rawScore: number
  metrics: Record<string, number | string>
  issues: HealthIssue[]
  timestamp: string
}

export interface HealthIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
  rule?: string
  fix?: string
}

export interface Collector {
  name: string
  dimension: string
  weight: number
  collect(servicePath: string): Promise<CollectorResult>
}

export interface ServiceHealth {
  service: string
  path: string
  dimensions: CollectorResult[]
  compositeScore: number
  grade: string
  issueCount: { error: number; warning: number; info: number }
  timestamp: string
}

export interface HealthSnapshot {
  generated: string
  gitSha: string
  gitBranch: string
  services: ServiceHealth[]
}

export interface ServiceEntry {
  name: string
  path: string
  type: 'nextjs' | 'hono' | 'elysia' | 'cli' | 'library'
}

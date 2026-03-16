import type { Config } from 'jest'
import nextJest from 'next/jest.js'

export type CoverageLevel = 'minimal' | 'standard' | 'strict'

export interface JestConfigOptions {
  testEnvironment?: string
  testTimeout?: number
  coverageFrom?: string[]
  coverageLevel?: CoverageLevel
  [key: string]: unknown
}

const coverageThresholds: Record<CoverageLevel, Config['coverageThreshold']> = {
  minimal: {
    global: { branches: 30, functions: 30, lines: 30, statements: 30 },
  },
  standard: {
    global: { branches: 60, functions: 60, lines: 60, statements: 60 },
  },
  strict: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
}

const defaultCoverageFrom = [
  'lib/**/*.ts',
  'components/**/*.tsx',
  'app/**/*.ts',
  'app/**/*.tsx',
  '!**/*.d.ts',
  '!**/index.ts',
]

export function createJestConfig(options: JestConfigOptions = {}) {
  const {
    testEnvironment = 'jsdom',
    testTimeout = 10000,
    coverageFrom,
    coverageLevel,
    ...rest
  } = options

  const config: Config = {
    testEnvironment,
    testTimeout,
    coverageProvider: 'v8',
    setupFilesAfterEnv: ['@perfectline-io/testing/jest/setup'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
    testMatch: ['**/*.test.ts', '**/*.test.tsx'],
    testPathIgnorePatterns: [
      '<rootDir>/e2e/',
      '<rootDir>/node_modules/',
      '<rootDir>/.next/',
    ],
    collectCoverageFrom: coverageFrom ?? defaultCoverageFrom,
    coverageReporters: ['json-summary', 'text', 'lcov'],
    ...(coverageLevel ? { coverageThreshold: coverageThresholds[coverageLevel] } : {}),
    ...rest,
  }

  const createConfig = nextJest({ dir: './' })
  return createConfig(config)
}

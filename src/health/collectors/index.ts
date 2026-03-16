import type { Collector } from '../../types'
import { typeSafetyCollector } from './type-safety'
import { lintCollector } from './lint'
import { coverageCollector } from './coverage'
import { testHealthCollector } from './test-health'
import { dependenciesCollector } from './dependencies'
import { bundleCollector } from './bundle'
import { complexityCollector } from './complexity'

export {
  typeSafetyCollector,
  lintCollector,
  coverageCollector,
  testHealthCollector,
  dependenciesCollector,
  bundleCollector,
  complexityCollector,
}

export const defaultCollectors: Collector[] = [
  typeSafetyCollector,
  lintCollector,
  coverageCollector,
  testHealthCollector,
  dependenciesCollector,
  bundleCollector,
  complexityCollector,
]

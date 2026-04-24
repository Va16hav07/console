/**
 * Runtime Card Config Tests
 */
import { describe, it, expect } from 'vitest'
import { chaosMeshStatusConfig } from '../chaos-mesh-status'

const runtimeCards = [
  { name: 'chaosMeshStatus', config: chaosMeshStatusConfig },
]

describe('Runtime card configs', () => {
  it.each(runtimeCards)('$name has valid type, title, category', ({ config }) => {
    expect(config.type).toBeTruthy()
    expect(config.category).toBe('runtime')
  })

  it.each(runtimeCards)('$name has valid columns array', ({ config }) => {
    expect(Array.isArray(config.columns)).toBe(true)
    expect(config.columns?.length).toBeGreaterThan(0)
    config.columns?.forEach(col => {
      expect(col.key).toBeTruthy()
      expect(col.label).toBeTruthy()
    })
  })
})

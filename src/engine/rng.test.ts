import { describe, expect, it } from 'vitest'
import { seeded } from './rng'

describe('seeded', () => {
  it('same seed gives the same sequence', () => {
    const a = seeded(42)
    const b = seeded(42)
    for (let i = 0; i < 100; i++) expect(a()).toBe(b())
  })

  it('different seeds diverge', () => {
    expect(seeded(1)()).not.toBe(seeded(2)())
  })

  it('stays in [0, 1)', () => {
    const r = seeded(7)
    for (let i = 0; i < 10000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

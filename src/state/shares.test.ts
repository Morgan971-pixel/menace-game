import { describe, expect, it } from 'vitest'
import { percentShares } from './shares'

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)

describe('percentShares', () => {
  it('gives one third each as 34, 33, 33 (sums to 100)', () => {
    expect(percentShares([1, 1, 1])).toEqual([34, 33, 33])
  })
  it('keeps exact shares', () => {
    expect(percentShares([1, 3])).toEqual([25, 75])
    expect(percentShares([4, 0, 0, 0])).toEqual([100, 0, 0, 0])
  })
  it('gives zeros for an empty box', () => {
    expect(percentShares([0, 0, 0])).toEqual([0, 0, 0])
    expect(percentShares([])).toEqual([])
  })
  it('never moves a share by a whole point or more from its exact value', () => {
    const counts = [7, 3, 11, 1, 5, 2, 9]
    const total = sum(counts)
    percentShares(counts).forEach((p, i) => expect(Math.abs(p - (counts[i] * 100) / total)).toBeLessThan(1))
  })
  it('always sums to exactly 100 for many random boxes', () => {
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let t = 0; t < 2000; t++) {
      const n = 1 + Math.floor(rnd() * 9)
      const counts = Array.from({ length: n }, () => Math.floor(rnd() * 40))
      const out = percentShares(counts)
      if (sum(counts) === 0) expect(sum(out)).toBe(0)
      else expect(sum(out)).toBe(100)
    }
  })
})

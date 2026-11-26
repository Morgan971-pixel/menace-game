import { describe, expect, it } from 'vitest'
import { bestLine } from './challengeText'

describe('bestLine', () => {
  it('prefers a win, then survival, else nothing', () => {
    expect(bestLine({ won: 7, survived: 12 })).toMatch(/in 7 games/)
    expect(bestLine({ won: null, survived: 10 })).toMatch(/10 games before the lock/)
    expect(bestLine({ won: null, survived: 0 })).toBe('')
  })
})

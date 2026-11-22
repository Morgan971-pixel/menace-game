import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../engine/menace'
import { seeded } from '../engine/rng'
import {
  THINK, confidence, createSay, endLine, firstGameLine, fmt, forcedLine, importLine, openingLine,
  percent, resetLine, resignLine, rewardsLine, rulesLine, returningLine, summaryLine, thinkLine, trainLine, trainStartLine,
  howSteps, howSymmetry, type Say,
} from './lines'

const LIMIT = 70

/** A Say that records every option offered per situation and always takes the first. */
function recorder() {
  const seen = new Map<string, string[]>()
  const say: Say = (situation, options) => {
    seen.set(situation, [...options])
    return options[0]
  }
  return { say, seen }
}

/** Calls every line function with the widest numbers and collects the options by situation. */
function everyLine(box: number, pct: number, games: number): Map<string, string[]> {
  const { say, seen } = recorder()
  for (const sure of [0.9, 0.4, 0.1, pct / 100]) thinkLine(say, box, sure)
  forcedLine(say)
  resignLine(say, box)
  for (const r of ['X', 'O', 'D'] as const) for (const n of [1, 5]) endLine(say, r, n)
  openingLine(say)
  firstGameLine(say)
  returningLine(say, games)
  returningLine(say, 1)
  resetLine(say)
  rulesLine(say, '1961')
  rulesLine(say, 'engine')
  rewardsLine(say)
  importLine(say, box)
  trainStartLine(say, 'Perfect', 100_000)
  for (const r of ['X', 'O', 'D'] as const) {
    summaryLine(say, { result: r, boxes: 5, beads: 1_234_567, resignBox: null })
    summaryLine(say, { result: r, boxes: 1, beads: 1, resignBox: null })
  }
  summaryLine(say, { result: 'O', boxes: 4, beads: 4, resignBox: box })
  // The training summary carries counts; its options are the tails, checked below.
  trainLine(say, 'Perfect', { total: 10, done: 10, won: 0, drawn: 0, lost: 10 }, false)
  trainLine(say, 'Perfect', { total: 10, done: 10, won: 9, drawn: 1, lost: 0 }, false)
  trainLine(say, 'Perfect', { total: 10, done: 10, won: 9, drawn: 0, lost: 1 }, false)
  return seen
}

describe('every line', () => {
  const seen = everyLine(304, 100, 1_234_567)

  it('is plain text under the length limit with no em dash', () => {
    for (const [situation, options] of seen) {
      for (const line of options) {
        expect(line.length, `${situation}: ${line}`).toBeLessThanOrEqual(LIMIT)
        expect(line, `${situation}: ${line}`).not.toMatch(/[—–]/)
        expect(line, `${situation}: ${line}`).not.toMatch(/[<>*_`#]/)
      }
    }
  })

  it('has at least 4 variants for each situation', () => {
    for (const [situation, options] of seen) expect(options.length, situation).toBeGreaterThanOrEqual(4)
  })

  it('covers every situation the voice needs', () => {
    for (const s of [
      'think:sure', 'think:mid', 'think:unsure', 'forced', 'resign', 'end:win', 'end:loss', 'end:draw',
      'summary:win', 'summary:loss', 'summary:draw', 'summary:resign', 'first', 'returning', 'reset', 'import', 'train:start', 'rules:1961', 'rules:engine', 'rewards',
    ]) expect(seen.has(s), s).toBe(true)
  })

  it('keeps the how-it-works copy free of em dashes, under both rule sets', () => {
    for (const rules of ['1961', 'engine'] as const) {
      const config = defaultConfig(rules)
      for (const s of howSteps(config)) expect(s.body + s.title).not.toMatch(/[—–]/)
      expect(howSymmetry(config)).not.toMatch(/[—–]/)
    }
  })

  it('states the real numbers in how it works (1961 defaults)', () => {
    const config = defaultConfig('1961')
    const text = howSteps(config).map((s) => s.body).join(' ')
    expect(text).toContain('4 beads per square')
    expect(text).toContain('36')
    expect(text).toContain('3 beads')
    expect(howSymmetry(config)).toContain('304 boxes')
    expect(howSymmetry(config)).not.toContain('338')
  })

  it('takes the numbers from the live settings', () => {
    const config = { rules: '1961' as const, startBeads: [7, 3, 2, 1] as [number, number, number, number], rewards: { win: 5, draw: 2, loss: -3 } }
    const text = howSteps(config).map((s) => s.body).join(' ')
    expect(text).toContain('7 beads per square')
    expect(text).toContain('63')
    expect(text).toContain('5 beads')
    expect(text).toContain('2 beads')
    expect(text).toContain('3 beads of the colour it drew are removed')
    const one = howSteps({ ...config, rewards: { win: 1, draw: 1, loss: -1 } }).map((s) => s.body).join(' ')
    expect(one).toContain('gains 1 bead of')
    expect(one).toContain('Draw: 1 bead.')
    expect(howSteps({ ...config, rewards: { win: 3, draw: 0, loss: 0 } }).map((s) => s.body).join(' ')).toContain('Loss: nothing is removed')
  })

  it('under engine rules says up to 338 boxes made as positions come up, and never 304', () => {
    const config = { ...defaultConfig('engine'), startBeads: [6, 6, 6, 6] as [number, number, number, number] }
    expect(howSymmetry(config)).toContain('up to 338 boxes, made as each new position comes up')
    expect(howSymmetry(config)).not.toContain('304')
    const text = howSteps(config).map((s) => s.body).join(' ')
    expect(text).toContain('6 beads per square')
    expect(text).toContain('54')
    expect(text).toContain('never drops below 1')
  })
})

describe('no immediate repeats', () => {
  it('never says the same line twice in a row in any situation, over 1,000 picks', () => {
    const say = createSay(seeded(7))
    const calls: Record<string, () => string> = {
      sure: () => thinkLine(say, 3, 0.8),
      mid: () => thinkLine(say, 3, 0.4),
      unsure: () => thinkLine(say, 3, 0.1),
      forced: () => forcedLine(say),
      resign: () => resignLine(say, 9),
      win: () => endLine(say, 'X', 3),
      loss: () => endLine(say, 'O', 3),
      draw: () => endLine(say, 'D', 3),
      sumWin: () => summaryLine(say, { result: 'X', boxes: 3, beads: 9, resignBox: null }),
      sumLoss: () => summaryLine(say, { result: 'O', boxes: 3, beads: 3, resignBox: null }),
      sumDraw: () => summaryLine(say, { result: 'D', boxes: 3, beads: 3, resignBox: null }),
      sumResign: () => summaryLine(say, { result: 'O', boxes: 3, beads: 3, resignBox: 12 }),
      first: () => firstGameLine(say),
      returning: () => returningLine(say, 1204),
      reset: () => resetLine(say),
      rules1961: () => rulesLine(say, '1961'),
      rulesEngine: () => rulesLine(say, 'engine'),
      rewards: () => rewardsLine(say),
      import: () => importLine(say, 304),
      opening: () => openingLine(say),
    }
    for (const [name, call] of Object.entries(calls)) {
      let prev = ''
      const distinct = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        const line = call()
        expect(line, `${name} #${i}`).not.toBe(prev)
        prev = line
        distinct.add(line)
      }
      expect(distinct.size, name).toBeGreaterThanOrEqual(4)
    }
  })

  it('stays deterministic for a given seed', () => {
    const a = createSay(seeded(3))
    const b = createSay(seeded(3))
    for (let i = 0; i < 50; i++) expect(thinkLine(a, 2, 0.5)).toBe(thinkLine(b, 2, 0.5))
  })

  it('with a single option, returns it every time', () => {
    const say = createSay(seeded(1))
    expect(say('x', ['only'])).toBe('only')
    expect(say('x', ['only'])).toBe('only')
  })
})

describe('confidence buckets', () => {
  it('splits at over 60% and under 25%', () => {
    expect(confidence(0.61)).toBe('sure')
    expect(confidence(0.6)).toBe('mid')
    expect(confidence(0.25)).toBe('mid')
    expect(confidence(0.249)).toBe('unsure')
    expect(confidence(1)).toBe('sure')
    expect(confidence(0.05)).toBe('unsure')
  })

  it('picks from the pool for its bucket', () => {
    for (const [share, bucket] of [[0.9, 'sure'], [0.4, 'mid'], [0.1, 'unsure']] as const) {
      const { say, seen } = recorder()
      thinkLine(say, 12, share)
      const pct = percent(share)
      expect([...seen.keys()]).toEqual([`think:${bucket}`])
      expect(seen.get(`think:${bucket}`)).toEqual(THINK[bucket].map((f) => f(12, pct)))
    }
  })

  it('keeps the three pools apart', () => {
    const all = (['sure', 'mid', 'unsure'] as const).flatMap((b) => THINK[b].map((f) => f(1, 50)))
    expect(new Set(all).size).toBe(all.length)
  })

  it('always names the real box and the percentage', () => {
    for (const share of [0.9, 0.4, 0.1]) {
      for (const f of THINK[confidence(share)]) {
        const line = f(77, percent(share))
        expect(line).toContain('Box 77')
        expect(line).toContain(`${percent(share)}%`)
      }
    }
  })
})

describe('numbers', () => {
  it('formats with thousands separators', () => {
    expect(fmt(1204)).toBe('1,204')
    expect(fmt(1_234_567)).toBe('1,234,567')
    expect(fmt(7)).toBe('7')
  })

  it('returning line uses them', () => {
    const { say, seen } = recorder()
    returningLine(say, 1204)
    expect(seen.get('returning')?.every((l) => l.includes('1,204'))).toBe(true)
    expect(seen.get('returning')).toContain('Back for more. I remember all 1,204 games.')
  })

  it('import, training and summary lines use them', () => {
    const { say, seen } = recorder()
    importLine(say, 1304)
    expect(seen.get('import')?.every((l) => l.includes('1,304'))).toBe(true)
    expect(trainStartLine(say, 'Random', 10_000)).toContain('10,000 games')
    expect(summaryLine(say, { result: 'X', boxes: 4, beads: 12_000, resignBox: null })).toContain('12,000')
    expect(trainLine(say, 'Random', { total: 5000, done: 2500, won: 1500, drawn: 500, lost: 500 }, true)).toMatch(/^Stopped after 2,500 of 5,000 games/)
  })
})

describe('percent', () => {
  it('rounds and never shows 0 for a square holding beads', () => {
    expect(percent(0)).toBe(0)
    expect(percent(0.001)).toBe(1)
    expect(percent(0.4449)).toBe(44)
    expect(percent(1)).toBe(100)
  })
})

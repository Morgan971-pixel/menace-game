import { describe, expect, it } from 'vitest'
import type { Result } from '../engine/board'
import {
  BUCKET_GAMES,
  MAX_BINS,
  MAX_BUCKETS,
  MAX_RUNS,
  addResults,
  curvePoints,
  curveTotal,
  curveView,
  emptyCurve,
  latestRunShare,
  latestRunStart,
  markPlayer,
  parseCurve,
  startRun,
  markTinker,
  type Curve,
} from './curve'

const run = (rs: string): Result[] => [...rs] as Result[]

/** A deterministic result stream with a drifting win rate, so bins differ from each other. */
function stream(n: number, seed = 1): Result[] {
  const out: Result[] = []
  let a = seed
  for (let i = 0; i < n; i++) {
    a = (a * 1103515245 + 12345) & 0x7fffffff
    const r = (a >> 8) % 100
    const winShare = Math.min(80, 20 + Math.floor(i / 400))
    out.push(r < winShare ? 'X' : r < winShare + 10 ? 'D' : 'O')
  }
  return out
}

const count = (rs: readonly Result[]) => ({
  won: rs.filter((r) => r === 'X').length,
  drawn: rs.filter((r) => r === 'D').length,
  lost: rs.filter((r) => r === 'O').length,
})

describe('addResults', () => {
  it('starts empty and counts games into 10-game buckets', () => {
    let c = emptyCurve()
    expect(curveTotal(c)).toBe(0)
    c = addResults(c, run('XXXXXDDOOO'))
    expect(c.buckets).toEqual([[5, 2, 3]])
    expect(c.tail).toEqual([0, 0, 0])
    c = addResults(c, run('XXX'))
    expect(c.buckets.length).toBe(1)
    expect(c.tail).toEqual([3, 0, 0])
    expect(curveTotal(c)).toBe(13)
  })

  it('does not change the curve it was given', () => {
    const c = addResults(emptyCurve(), run('XXXXXXXXXXD'))
    const before = JSON.stringify(c)
    addResults(c, run('OOOOOOOOOOOOOOO'))
    expect(JSON.stringify(c)).toBe(before)
  })

  it('keeps the total when it merges pairs after MAX_BUCKETS', () => {
    const games = (MAX_BUCKETS + 1) * BUCKET_GAMES + 7
    const c = addResults(emptyCurve(), stream(games))
    expect(c.buckets.length).toBeLessThanOrEqual(MAX_BUCKETS)
    expect(c.per).toBe(BUCKET_GAMES * 2)
    expect(curveTotal(c)).toBe(games)
    for (const b of c.buckets) expect(b[0] + b[1] + b[2]).toBe(c.per)
    expect(c.tail[0] + c.tail[1] + c.tail[2]).toBeLessThan(c.per)
  })

  it('handles one huge batch the same as many small ones', () => {
    const rs = stream(6400, 3)
    const whole = addResults(emptyCurve(), rs)
    let piecemeal = emptyCurve()
    for (let i = 0; i < rs.length; i += 37) piecemeal = addResults(piecemeal, rs.slice(i, i + 37))
    expect(piecemeal).toEqual(whole)
  })
})

describe('curveView bins', () => {
  it('cover every game exactly once, with exact counts, before any merge', () => {
    const rs = stream(13_525, 5)
    const view = curveView(addResults(emptyCurve(), rs))
    expect(view.bins.length).toBeLessThanOrEqual(MAX_BINS)
    expect(view.bins[0].start).toBe(1)
    expect(view.bins[view.bins.length - 1].end).toBe(13_525)
    view.bins.forEach((b, i) => {
      if (i > 0) expect(b.start).toBe(view.bins[i - 1].end + 1)
      expect({ won: b.won, drawn: b.drawn, lost: b.lost }).toEqual(count(rs.slice(b.start - 1, b.end)))
      expect(b.games).toBe(b.end - b.start + 1)
    })
    const sum = view.bins.reduce((a, b) => ({ won: a.won + b.won, drawn: a.drawn + b.drawn, lost: a.lost + b.lost }), { won: 0, drawn: 0, lost: 0 })
    expect(sum).toEqual(count(rs))
  })

  it('still sum exactly to the totals after buckets have merged', () => {
    const rs = stream(26_013, 7)
    const curve = addResults(emptyCurve(), rs)
    expect(curve.per).toBeGreaterThan(BUCKET_GAMES)
    const view = curveView(curve)
    expect(view.bins.length).toBeLessThanOrEqual(MAX_BINS)
    expect(view.bins.reduce((n, b) => n + b.games, 0)).toBe(26_013)
    view.bins.forEach((b) => expect({ won: b.won, drawn: b.drawn, lost: b.lost }).toEqual(count(rs.slice(b.start - 1, b.end))))
  })

  it('includes the unfinished tail in the last bin, so the summary and the plot agree on it', () => {
    const rs = stream(1003, 9)
    const view = curveView(addResults(emptyCurve(), rs))
    expect(view.bins[view.bins.length - 1].end).toBe(1003)
  })

  it('states a nominal bin size that is a multiple of the bucket size', () => {
    const curve = addResults(emptyCurve(), stream(13_520))
    const view = curveView(curve)
    expect(view.size).toBe(120)
    expect(view.size % curve.per).toBe(0)
  })

  it('keeps a short view to about ten bins instead of three wide ones', () => {
    const view = curveView(addResults(emptyCurve(), stream(105)))
    expect(view.size).toBe(10)
    expect(view.bins.length).toBe(10) // ten buckets, the tail joins the last
    const longer = curveView(addResults(emptyCurve(), stream(4100)))
    expect(longer.size).toBe(40)
  })

  it('is empty for a curve with no games, and one bin for a handful', () => {
    expect(curveView(emptyCurve()).bins).toEqual([])
    const few = curveView(addResults(emptyCurve(), run('XXD')))
    expect(few.bins.length).toBe(1)
    expect(few.bins[0]).toMatchObject({ start: 1, end: 3, won: 2, drawn: 1, lost: 0 })
  })

  it('can start at the bucket holding a given game (for a latest-run view)', () => {
    const rs = stream(2000, 4)
    const view = curveView(addResults(emptyCurve(), rs), { from: 1900 })
    expect(view.bins[0].start).toBe(1901)
    expect(view.bins[view.bins.length - 1].end).toBe(2000)
    expect(view.bins.reduce((n, b) => n + b.won + b.drawn + b.lost, 0)).toBe(100)
    // A start inside a bucket reaches back to that bucket's first game.
    const inside = curveView(addResults(emptyCurve(), rs), { from: 1905 })
    expect(inside.bins[0].start).toBe(1901)
  })
})

describe('end labels and summary read the same bin as the plot', () => {
  // 13,420 Random-like wins, then 100 games MENACE never wins.
  const curve = addResults(addResults(startRun(emptyCurve(), 'random'), run('X'.repeat(13_420))), run('D'.repeat(70) + 'O'.repeat(30)))
  const withPerfect = (() => {
    const c = addResults(emptyCurve(), run('X'.repeat(13_420)))
    return addResults(startRun(c, 'perfect'), run('D'.repeat(70) + 'O'.repeat(30)))
  })()

  it('labels equal the last bin, and the plotted right edge equals the labels', () => {
    for (const c of [curve, withPerfect]) {
      const view = curveView(c)
      const last = view.bins[view.bins.length - 1]
      expect(view.last).toEqual({
        start: last.start,
        end: last.end,
        games: last.games,
        win: last.won / last.games,
        draw: last.drawn / last.games,
        loss: last.lost / last.games,
      })
      const pts = curvePoints(view.bins)
      const edge = pts[pts.length - 1]
      expect(edge.x).toBe(last.end)
      expect(edge.win).toBe(view.last!.win)
      expect(edge.draw).toBe(view.last!.draw)
      expect(edge.loss).toBe(view.last!.loss)
    }
  })

  it('the summary names the last bin range and ends with the latest run', () => {
    const view = curveView(withPerfect)
    const last = view.bins[view.bins.length - 1]
    const pct = (x: number) => `${Math.round(x * 100)}%`
    const n = (v: number) => v.toLocaleString('en-US')
    const mix = `won ${pct(last.won / last.games)}, drew ${pct(last.drawn / last.games)}, lost ${pct(last.lost / last.games)}`
    expect(view.summary).toBe(`Over games ${n(last.start)} to ${n(last.end)} MENACE ${mix}. Latest run: 100 against Perfect.`)
  })

  it('the latest-run view ends on the same numbers the user just produced', () => {
    const view = curveView(withPerfect, { from: 13_420 })
    expect(view.bins[0].start).toBe(13_421)
    const last = view.bins[view.bins.length - 1]
    expect(last.end).toBe(13_520)
    expect(view.bins.reduce((n, b) => n + b.drawn, 0)).toBe(70)
    expect(view.bins.reduce((n, b) => n + b.lost, 0)).toBe(30)
  })

  it('says so when there are no games', () => {
    expect(curveView(emptyCurve()).summary).toMatch(/no games/i)
    expect(curveView(emptyCurve()).last).toBeNull()
  })
})

describe('runs', () => {
  it('records where each run started, with the opponent', () => {
    let c = addResults(emptyCurve(), run('X'.repeat(25)))
    c = startRun(c, 'perfect')
    expect(c.runs).toEqual([{ start: 25, opponent: 'perfect' }])
    c = addResults(c, run('D'.repeat(10)))
    c = markPlayer(c)
    expect(c.runs).toEqual([
      { start: 25, opponent: 'perfect' },
      { start: 35, opponent: 'player' },
    ])
    // Already marked: nothing to add. And no training yet: nothing to mark.
    expect(markPlayer(c)).toBe(c)
    expect(markPlayer(emptyCurve()).runs).toEqual([])
  })

  it('keeps the newest MAX_RUNS', () => {
    let c: Curve = emptyCurve()
    for (let i = 0; i < MAX_RUNS + 10; i++) c = addResults(startRun(c, i % 2 ? 'random' : 'itself'), run('X'))
    expect(c.runs.length).toBe(MAX_RUNS)
    expect(c.runs[MAX_RUNS - 1].start).toBe(MAX_RUNS + 9)
    expect(c.runs[0].start).toBe(10)
  })

  it('survive merges (they are game numbers)', () => {
    let c = startRun(addResults(emptyCurve(), stream(30)), 'random')
    c = addResults(c, stream((MAX_BUCKETS + 2) * BUCKET_GAMES))
    expect(c.runs).toEqual([{ start: 30, opponent: 'random' }])
  })

  it('the summary tells the latest run, or says it was the player', () => {
    const c = addResults(startRun(addResults(emptyCurve(), run('X'.repeat(50))), 'itself'), run('D'.repeat(1000)))
    expect(curveView(c).summary).toMatch(/Latest run: 1,000 against Itself\.$/)
    const p = addResults(markPlayer(c), run('X'.repeat(4)))
    expect(curveView(p).summary).toMatch(/Latest run: 4 against you\.$/)
  })
})

describe('parseCurve', () => {
  it('round-trips through JSON, runs included', () => {
    let c = addResults(emptyCurve(), stream(500))
    c = addResults(startRun(c, 'perfect'), stream(100, 2))
    c = markPlayer(addResults(c, run('X')))
    expect(parseCurve(JSON.parse(JSON.stringify(c)))).toEqual(c)
  })

  it('reads nothing as an empty curve, and a curve without runs as one with none', () => {
    expect(parseCurve(undefined)).toEqual(emptyCurve())
    const old = parseCurve({ per: 10, buckets: [[5, 5, 0]], tail: [0, 0, 0] })
    expect(old).not.toBeNull()
    expect(old!.runs).toEqual([])
  })

  it('rejects damage', () => {
    expect(parseCurve({ per: 10, buckets: [[1, 2]], tail: [0, 0, 0] })).toBeNull()
    expect(parseCurve({ per: 10, buckets: [[5, 5, 5]], tail: [0, 0, 0] })).toBeNull()
    expect(parseCurve({ per: 10, buckets: [], tail: [10, 0, 0] })).toBeNull()
    expect(parseCurve({ per: 10, buckets: [], tail: [-1, 0, 0] })).toBeNull()
    expect(parseCurve({ per: 7, buckets: [], tail: [0, 0, 0] })).toBeNull()
    expect(parseCurve('nope')).toBeNull()
    const tooMany = { per: 10, buckets: Array.from({ length: MAX_BUCKETS + 1 }, () => [10, 0, 0]), tail: [0, 0, 0] }
    expect(parseCurve(tooMany)).toBeNull()
  })

  it('checks the bucket size with exact maths, not 32-bit maths', () => {
    // 10 * 3 * 2^32: a multiple of 10 whose quotient is not a power of two, but whose low 32 bits look like one.
    expect(parseCurve({ per: 10 * 3 * 2 ** 32, buckets: [], tail: [0, 0, 0] })).toBeNull()
    // 10 * 2^70 is not a safe integer.
    expect(parseCurve({ per: 10 * 2 ** 70, buckets: [], tail: [0, 0, 0] })).toBeNull()
    // Above the cap even though it is a power of two times 10.
    expect(parseCurve({ per: 10 * 2 ** 31, buckets: [], tail: [0, 0, 0] })).toBeNull()
    expect(parseCurve({ per: 10 * 2 ** 30, buckets: [], tail: [0, 0, 0] })).not.toBeNull()
    expect(parseCurve({ per: 20, buckets: [[20, 0, 0]], tail: [0, 0, 0] })).not.toBeNull()
    expect(parseCurve({ per: 30, buckets: [], tail: [0, 0, 0] })).toBeNull()
  })

  it('validates runs', () => {
    const base = { per: 10, buckets: [[10, 0, 0], [10, 0, 0]], tail: [0, 0, 0] }
    expect(parseCurve({ ...base, runs: [{ start: 10, opponent: 'perfect' }] })).not.toBeNull()
    expect(parseCurve({ ...base, runs: [{ start: 10, opponent: 'nobody' }] })).toBeNull()
    expect(parseCurve({ ...base, runs: [{ start: -1, opponent: 'random' }] })).toBeNull()
    expect(parseCurve({ ...base, runs: [{ start: 1.5, opponent: 'random' }] })).toBeNull()
    // A run cannot start after the last game.
    expect(parseCurve({ ...base, runs: [{ start: 21, opponent: 'random' }] })).toBeNull()
    // Starts must not go backwards.
    expect(parseCurve({ ...base, runs: [{ start: 10, opponent: 'random' }, { start: 5, opponent: 'player' }] })).toBeNull()
    expect(parseCurve({ ...base, runs: 'x' })).toBeNull()
    const many = Array.from({ length: MAX_RUNS + 1 }, () => ({ start: 0, opponent: 'random' }))
    expect(parseCurve({ ...base, runs: many })).toBeNull()
  })
})

describe('latest run helpers', () => {
  it('report where the latest run began and how much of the history it covers', () => {
    const c = addResults(startRun(addResults(emptyCurve(), run('X'.repeat(900))), 'perfect'), run('D'.repeat(100)))
    expect(latestRunStart(c)).toBe(900)
    expect(latestRunShare(c)).toBeCloseTo(0.1, 10)
    expect(latestRunStart(emptyCurve())).toBeNull()
    expect(latestRunShare(addResults(emptyCurve(), run('XX')))).toBe(1)
  })
})

describe('tinker marker (rewards changed)', () => {
  it('marks where the rewards changed, once per spot, and not on an empty curve', () => {
    expect(markTinker(emptyCurve()).runs).toEqual([])
    let c = addResults(emptyCurve(), stream(40))
    c = markTinker(c)
    expect(c.runs).toEqual([{ start: 40, opponent: 'tinker' }])
    expect(markTinker(c)).toBe(c)
    c = markTinker(addResults(c, stream(5)))
    expect(c.runs.map((r) => r.start)).toEqual([40, 45])
  })

  it('a player game right after the marker does not bury it under a "you" mark', () => {
    const c = markPlayer(markTinker(addResults(emptyCurve(), stream(40))))
    expect(c.runs).toEqual([{ start: 40, opponent: 'tinker' }])
  })

  it('survives JSON through parseCurve, and an unknown opponent is still rejected', () => {
    const c = markTinker(addResults(emptyCurve(), stream(40)))
    expect(parseCurve(JSON.parse(JSON.stringify(c)))).toEqual(c)
    const bad = JSON.parse(JSON.stringify(c))
    bad.runs[0].opponent = 'bogus'
    expect(parseCurve(bad)).toBeNull()
  })
})

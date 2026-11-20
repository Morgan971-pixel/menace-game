import { describe, expect, it } from 'vitest'
import { TRANSFORMS, canonicalize, legalMoves, winner, type Cell } from './board'
import {
  beadsOf,
  boxIndex,
  boxKeys,
  chooseMove,
  createMenace,
  defaultConfig,
  deserialize,
  inspect,
  learn,
  moveNumber,
  serialize,
  type HistoryEntry,
  type Menace,
} from './menace'
import { seeded } from './rng'
import { countOf, fromString, setBeads, snapshot, xToMovePositions } from './testing'

const EMPTY_BOARD = (): Cell[] => Array<Cell>(9).fill(null)

describe('1961 rules: box layout', () => {
  const m = createMenace()

  it('has exactly 304 boxes split 1/12/108/183 by move number', () => {
    expect(m.boxes.size).toBe(304)
    const split = [0, 0, 0, 0]
    for (const key of m.boxes.keys()) {
      const xs = [...key].filter((c) => c === 'X').length
      split[xs] += 1
    }
    expect(split).toEqual([1, 12, 108, 183])
  })

  it('seeds 4/3/2/1 beads on legal squares and 0 on occupied ones', () => {
    const expected = [4, 3, 2, 1]
    for (const [key, beads] of m.boxes) {
      const stage = [...key].filter((c) => c === 'X').length
      for (let i = 0; i < 9; i++) {
        expect(beads[i]).toBe(key[i] === ' ' ? expected[stage] : 0)
      }
    }
  })

  it('boxKeys is ordered by move number then key, with stable indices', () => {
    const keys = boxKeys(m)
    expect(keys).toHaveLength(304)
    expect(new Set(keys).size).toBe(304)
    const stages = keys.map((k) => [...k].filter((c) => c === 'X').length)
    expect(stages).toEqual([...stages].sort((a, b) => a - b))
    expect(keys[0]).toBe('         ')
    keys.forEach((k, i) => expect(boxIndex(m, k)).toBe(i))
  })

  it('moveNumber is the count of X plus one', () => {
    expect(moveNumber(EMPTY_BOARD())).toBe(1)
    expect(moveNumber(fromString('XO X     '))).toBe(3)
  })

  it('default configs', () => {
    expect(defaultConfig('1961').startBeads).toEqual([4, 3, 2, 1])
    expect(defaultConfig('engine').startBeads).toEqual([4, 4, 4, 4])
    expect(defaultConfig('1961').rewards).toEqual({ win: 3, draw: 1, loss: -1 })
  })
})

describe('engine rules: lazy boxes', () => {
  it('creates boxes on first visit and reaches 338 once every position is visited', () => {
    const m = createMenace(defaultConfig('engine'))
    expect(m.boxes.size).toBe(0)
    const rng = seeded(1)
    for (const cells of xToMovePositions()) chooseMove(m, cells, rng)
    expect(m.boxes.size).toBe(338)
  })
})

describe('regression: chooseMove never returns an occupied square', () => {
  for (const rules of ['1961', 'engine'] as const) {
    it(`${rules}: every reachable X-to-move position`, () => {
      const m = createMenace(defaultConfig(rules))
      const rng = seeded(7)
      const positions = xToMovePositions()
      expect(positions.length).toBeGreaterThan(1000)
      for (const cells of positions) {
        for (let rep = 0; rep < 3; rep++) {
          const choice = chooseMove(m, cells, rng)
          if (choice.kind === 'resign') throw new Error('unexpected resign')
          expect(cells[choice.square]).toBeNull()
          expect(legalMoves(cells)).toContain(choice.square)
          if (choice.entry !== null) {
            const { perm } = canonicalize(cells)
            expect(TRANSFORMS).toContainEqual(perm)
            expect(perm[choice.entry.canonMove]).toBe(choice.square)
          }
        }
      }
    })
  }
})

describe('forced move 5 (1961)', () => {
  it('returns the only empty square with no entry', () => {
    const m = createMenace()
    const cells = fromString('XOXOXOOX ')
    // X to move: 4 X and 4 O, square 8 is empty.
    expect(countOf(cells, 'X')).toBe(4)
    const choice = chooseMove(m, cells, seeded(3))
    expect(choice).toEqual({ kind: 'move', square: 8, entry: null, forced: true })
    expect(m.boxes.size).toBe(304)
  })

  it('inspect reports no box for forced positions', () => {
    const m = createMenace()
    const info = inspect(m, fromString('XOXOXOOX '))
    expect(info.boxKey).toBeNull()
    expect(info.beads.every((b) => b === null)).toBe(true)
  })
})

describe('learn', () => {
  const history = (m: Menace, cells: Cell[]): HistoryEntry => {
    const c = chooseMove(m, cells, seeded(11))
    if (c.kind !== 'move' || c.entry === null) throw new Error('no entry')
    return c.entry
  }

  it('1961: +3 win, +1 draw, -1 loss on exactly the history entries', () => {
    const m = createMenace()
    const e = history(m, EMPTY_BOARD())
    const snap = snapshot(m)
    const before = snap.get(e.boxKey)!
    learn(m, [e], 'X')
    expect(m.boxes.get(e.boxKey)![e.canonMove]).toBe(before[e.canonMove] + 3)
    learn(m, [e], 'D')
    expect(m.boxes.get(e.boxKey)![e.canonMove]).toBe(before[e.canonMove] + 4)
    learn(m, [e], 'O')
    expect(m.boxes.get(e.boxKey)![e.canonMove]).toBe(before[e.canonMove] + 3)
    // Everything except that one bead matches the snapshot taken before learn.
    snap.get(e.boxKey)![e.canonMove] += 3
    expect([...m.boxes]).toEqual([...snap])
  })

  it('1961: floors at 0, empties the box, then resigns', () => {
    const m = createMenace()
    const cells = EMPTY_BOARD()
    const key = '         '
    const e = history(m, cells)
    for (let i = 0; i < 10; i++) learn(m, [e], 'O')
    expect(m.boxes.get(key)![e.canonMove]).toBe(0)
    // Empty every square of the first box.
    setBeads(m, key, Array<number>(9).fill(0))
    expect(chooseMove(m, cells, seeded(5))).toEqual({ kind: 'resign', boxKey: key })
  })

  it('1961: never resigns while a box still has a bead', () => {
    const m = createMenace()
    const beads = Array<number>(9).fill(0)
    beads[4] = 1
    setBeads(m, '         ', beads)
    const c = chooseMove(m, EMPTY_BOARD(), seeded(2))
    expect(c).toMatchObject({ kind: 'move', square: 4 })
  })

  it('engine: floors at 1 and never resigns', () => {
    const m = createMenace(defaultConfig('engine'))
    const cells = EMPTY_BOARD()
    const e = history(m, cells)
    for (let i = 0; i < 20; i++) learn(m, [e], 'O')
    expect(m.boxes.get(e.boxKey)![e.canonMove]).toBe(1)
    const rng = seeded(9)
    for (let i = 0; i < 50; i++) {
      expect(chooseMove(m, cells, rng).kind).toBe('move')
    }
  })

  it('1961: throws when a history entry has no box', () => {
    const m = createMenace()
    expect(() => learn(m, [{ boxKey: 'XXXXXXXXX', canonMove: 0 }], 'X')).toThrow(/box/i)
  })

  it('engine: ignores history entries whose box is missing', () => {
    const m = createMenace(defaultConfig('engine'))
    expect(() => learn(m, [{ boxKey: 'XXXXXXXXX', canonMove: 0 }], 'X')).not.toThrow()
  })
})

describe('inspect', () => {
  it('maps beads to real empty squares only', () => {
    const m = createMenace()
    const cells = fromString('X   O    ')
    const info = inspect(m, cells)
    expect(info.boxKey).toBe(canonicalize(cells).key)
    expect(info.beads).toHaveLength(9)
    info.beads.forEach((b, i) => {
      if (cells[i] === null) expect(b).toBe(3)
      else expect(b).toBeNull()
    })
  })

  it('follows perm so learned beads land on the right real square', () => {
    const m = createMenace()
    const cells = fromString('X   O    ')
    const rng = seeded(4)
    const c = chooseMove(m, cells, rng)
    if (c.kind !== 'move' || c.entry === null) throw new Error('expected entry')
    learn(m, [c.entry], 'X')
    const info = inspect(m, cells)
    expect(info.beads[c.square]).toBe(6)
  })
})

describe('serialize / deserialize', () => {
  it('round-trips exactly (1961 after some learning)', () => {
    const m = createMenace()
    const rng = seeded(21)
    for (let g = 0; g < 50; g++) playGame(m, rng)
    const json = serialize(m)
    const back = deserialize(json)
    expect(back.config).toEqual(m.config)
    expect([...back.boxes]).toEqual([...m.boxes])
    expect(serialize(back)).toBe(json)
  })

  it('round-trips an engine brain', () => {
    const m = createMenace(defaultConfig('engine'))
    const rng = seeded(22)
    for (let g = 0; g < 20; g++) playGame(m, rng)
    const back = deserialize(serialize(m))
    expect([...back.boxes]).toEqual([...m.boxes])
    expect(back.config.rules).toBe('engine')
  })

  const good = () => JSON.parse(serialize(createMenace())) as {
    version: number
    config: { rules: string }
    boxes: Record<string, number[]>
  }

  it('rejects malformed input', () => {
    expect(() => deserialize('not json')).toThrow(/JSON/)
    const wrongVersion = good()
    wrongVersion.version = 2
    expect(() => deserialize(JSON.stringify(wrongVersion))).toThrow(/version/)

    const badRules = good()
    badRules.config.rules = '1962'
    expect(() => deserialize(JSON.stringify(badRules))).toThrow(/rules/)

    const badKey = good()
    badKey.boxes['XXXXXXXXQ'] = Array(9).fill(0)
    expect(() => deserialize(JSON.stringify(badKey))).toThrow(/key/)

    const shortKey = good()
    shortKey.boxes['XX'] = Array(9).fill(0)
    expect(() => deserialize(JSON.stringify(shortKey))).toThrow(/key/)

    const wrongCount = good()
    delete wrongCount.boxes['         ']
    expect(() => deserialize(JSON.stringify(wrongCount))).toThrow(/304/)

    const negative = good()
    negative.boxes['         '][0] = -1
    expect(() => deserialize(JSON.stringify(negative))).toThrow(/beads/)

    const fractional = good()
    fractional.boxes['         '][0] = 1.5
    expect(() => deserialize(JSON.stringify(fractional))).toThrow(/beads/)

    const shortBeads = good()
    shortBeads.boxes['         '] = [1, 2, 3]
    expect(() => deserialize(JSON.stringify(shortBeads))).toThrow(/beads/)
  })
})


describe('inspect over every reachable position', () => {
  for (const rules of ['1961', 'engine'] as const) {
    it(`${rules}: beads sit on empty squares and learn shows on the chosen square only`, () => {
      const m = createMenace(defaultConfig(rules))
      const rng = seeded(31)
      for (const cells of xToMovePositions()) {
        const forced = rules === '1961' && moveNumber(cells) === 5
        const before = inspect(m, cells)
        before.beads.forEach((b, i) => {
          if (forced || cells[i] !== null) expect(b).toBeNull()
          else expect(b).not.toBeNull()
        })
        if (forced) continue
        const c = chooseMove(m, cells, rng)
        if (c.kind !== 'move' || c.entry === null) throw new Error('expected a move with an entry')
        learn(m, [c.entry], 'X')
        const after = inspect(m, cells)
        after.beads.forEach((b, i) => {
          const delta = b === null ? 0 : b - (before.beads[i] as number)
          expect(delta).toBe(i === c.square ? 3 : 0)
        })
      }
    })
  }
})

describe('state isolation', () => {
  it('two createMenace() calls share no state', () => {
    const a = createMenace()
    const b = createMenace()
    expect(a.config).not.toBe(b.config)
    expect(a.config.startBeads).not.toBe(b.config.startBeads)
    expect(a.boxes).not.toBe(b.boxes)
    expect(beadsOf(a, '         ')).not.toBe(beadsOf(b, '         '))
    const e = { boxKey: '         ', canonMove: 4 }
    learn(a, [e], 'X')
    expect(beadsOf(a, e.boxKey)[4]).toBe(7)
    expect(beadsOf(b, e.boxKey)[4]).toBe(4)
  })

  it('createMenace copies the config it is given', () => {
    const cfg = { ...defaultConfig('1961'), startBeads: [4, 3, 2, 1] as [number, number, number, number] }
    const m = createMenace(cfg)
    cfg.startBeads[0] = 99
    expect(m.config.startBeads[0]).toBe(4)
  })

  it('deserialize returns a config independent of the parsed input', () => {
    const a = deserialize(serialize(createMenace()))
    const b = deserialize(serialize(createMenace()))
    expect(a.config).not.toBe(b.config)
  })

  it('inspect on an engine brain does not create a box', () => {
    const m = createMenace(defaultConfig('engine'))
    const info = inspect(m, fromString('X   O    '))
    expect(info.boxKey).not.toBeNull()
    expect(m.boxes.size).toBe(0)
  })

  it('boxKeys and boxIndex follow an engine brain as boxes appear', () => {
    const m = createMenace(defaultConfig('engine'))
    expect(boxKeys(m)).toEqual([])
    chooseMove(m, EMPTY_BOARD(), seeded(1))
    expect(boxKeys(m)).toEqual(['         '])
    expect(boxIndex(m, '         ')).toBe(0)
    expect(boxIndex(m, 'nope')).toBe(-1)
  })
})

describe('chooseMove preconditions', () => {
  it('throws when the game is already over', () => {
    const m = createMenace()
    expect(() => chooseMove(m, fromString('XXXOO    '), seeded(1))).toThrow(/over/)
  })
})

describe('deserialize strictness', () => {
  const good = () => JSON.parse(serialize(createMenace())) as Record<string, any>
  const bad = (mut: (g: Record<string, any>) => void, re: RegExp) => {
    const g = good()
    mut(g)
    expect(() => deserialize(JSON.stringify(g))).toThrow(re)
  }

  it('requires the canonical 1961 key set, not just 304 well-formed keys', () => {
    bad((g) => {
      delete g.boxes['         ']
      g.boxes['XXXXXXXXX'] = Array(9).fill(0)
    }, /canonical/)
  })
  it('rejects non-zero beads on occupied squares', () => {
    bad((g) => {
      const key = Object.keys(g.boxes).find((k) => k.includes('X'))!
      g.boxes[key][key.indexOf('X')] = 1
    }, /occupied/)
  })
  it('rejects bad startBeads and rewards', () => {
    bad((g) => (g.config.startBeads = [4, 3, 2]), /startBeads/)
    bad((g) => (g.config.startBeads = [4, 3, 2, 1.5]), /startBeads/)
    bad((g) => (g.config.startBeads = [4, 3, 2, null]), /startBeads/)
    bad((g) => (g.config.rewards.win = 1.5), /rewards/)
    bad((g) => (g.config.rewards.loss = null), /rewards/)
    bad((g) => (g.config.rewards = null), /rewards/)
  })
  it('rejects missing config and malformed boxes', () => {
    bad((g) => delete g.config, /config/)
    bad((g) => (g.boxes = null), /boxes/)
    bad((g) => (g.boxes = []), /boxes/)
    expect(() => deserialize('null')).toThrow(/object/)
    expect(() => deserialize('[]')).toThrow(/object/)
  })
})

// ---- game driver used by the learning tests ----

function playGame(m: Menace, rng: () => number): 'X' | 'O' | 'D' {
  const cells = EMPTY_BOARD()
  const history: HistoryEntry[] = []
  let turn: 'X' | 'O' = 'X'
  let result: 'X' | 'O' | 'D' | null = null
  while (result === null) {
    if (turn === 'X') {
      const choice = chooseMove(m, cells, rng)
      if (choice.kind === 'resign') {
        result = 'O'
        break
      }
      if (choice.entry) history.push(choice.entry)
      cells[choice.square] = 'X'
    } else {
      const moves = legalMoves(cells)
      cells[moves[Math.floor(rng() * moves.length)]] = 'O'
    }
    result = winner(cells)
    turn = turn === 'X' ? 'O' : 'X'
  }
  learn(m, history, result)
  return result
}

describe('learning sanity (seeded, 1961 vs random opponent)', () => {
  it('loses less over the last 500 games than over the first 500', () => {
    const m = createMenace()
    const rng = seeded(2026)
    const losses: boolean[] = []
    for (let g = 0; g < 3000; g++) losses.push(playGame(m, rng) === 'O')
    const rate = (xs: boolean[]) => xs.filter(Boolean).length / xs.length
    const first = rate(losses.slice(0, 500))
    const last = rate(losses.slice(-500))
    expect(last).toBeLessThan(first - 0.03)
    const total = (b: Menace) => [...b.boxes.values()].flat().reduce((a, c) => a + c, 0)
    expect(total(m)).not.toBe(total(createMenace()))
  })
})

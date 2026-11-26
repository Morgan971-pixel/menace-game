import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMenace } from '../engine/menace'
import { seeded } from '../engine/rng'
import { setBeads } from '../engine/testing'
import { createGame } from '../state/store'
import { attachSound } from './attach'
import { SOUND_NAMES, cuesFor, type CueState, type SoundName } from './cues'
import { MUTE_KEY, createSound, type SoundDeps } from './sound'

const synthCalls: SoundName[] = []
const room = { started: 0, stopped: 0 }
vi.mock('./synth', () => ({
  synth: (_c: unknown, _o: unknown, name: SoundName) => synthCalls.push(name),
  roomTone: () => {
    room.started++
    return () => room.stopped++
  },
}))

function fakeContext() {
  const node = () => ({ connect: () => node(), gain: { value: 1 } })
  return { currentTime: 0, destination: {}, createGain: node, resume: () => Promise.resolve(), decodeAudioData: () => Promise.resolve({}) } as unknown as AudioContext
}

function memoryStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

function deps(over: Partial<SoundDeps> = {}): SoundDeps {
  return { makeContext: vi.fn(fakeContext), storage: memoryStorage(), loadManifest: async () => [], loadFile: async () => new ArrayBuffer(0), ...over }
}

beforeEach(() => {
  synthCalls.length = 0
  room.started = 0
  room.stopped = 0
})

const base: CueState = { phase: 'menace', board: Array(9).fill(null), turn: null, result: null, ledger: [], ledgerAt: -1, speed: 1, training: null }

describe('cuesFor: every listed event has a sound', () => {
  it('a MENACE turn: box slides out, rattle, bead drop, slides back, in that order', () => {
    const c = cuesFor(base, { ...base, turn: { id: 1, forced: false, landed: false } })
    expect(c.map((x) => x.name)).toEqual(['slide', 'rattle', 'drop', 'slide'])
    expect(c.map((x) => x.delay)).toEqual([...c.map((x) => x.delay)].sort((a, b) => a - b))
  })

  it('a forced move has no box, so no box sounds', () => {
    expect(cuesFor(base, { ...base, turn: { id: 1, forced: true, landed: false } })).toEqual([])
  })

  it('a mark drawn on the paper (X or O)', () => {
    const board = [...base.board]
    board[4] = 'O'
    expect(cuesFor(base, { ...base, board }).map((x) => x.name)).toEqual(['mark'])
  })

  it.each([['X', 'menaceWins'], ['O', 'youWin'], ['D', 'draw']] as const)('result %s plays the %s stinger', (result, name) => {
    expect(cuesFor(base, { ...base, phase: 'ledger', result }).map((x) => x.name)).toContain(name)
  })

  it('ledger boxes: beads added on a reward, one confiscated on a loss, timed by the speed', () => {
    const ledger = [{ kind: 'reward' as const, delta: 3 }, { kind: 'reward' as const, delta: -1 }, { kind: 'resign' as const, delta: 0 }]
    const s = { ...base, phase: 'ledger', result: 'X' as const, ledger }
    const a = cuesFor(s, { ...s, ledgerAt: 0 })
    expect(a.map((x) => x.name)).toEqual(['slide', 'add'])
    const b = cuesFor({ ...s, ledgerAt: 0 }, { ...s, ledgerAt: 1, speed: 2 })
    expect(b.map((x) => x.name)).toEqual(['slide', 'confiscate'])
    expect(b[1].delay).toBeCloseTo(a[1].delay / 2)
    expect(cuesFor({ ...s, ledgerAt: 1 }, { ...s, ledgerAt: 2 }).map((x) => x.name)).toEqual(['slide'])
  })

  it('every sound name is either cued, a UI click, or the room tone', () => {
    expect([...SOUND_NAMES].sort()).toEqual(['add', 'click', 'confiscate', 'draw', 'drop', 'mark', 'menaceWins', 'rattle', 'room', 'slide', 'youWin'])
  })
})

describe('sound player', () => {
  it('makes no audio context and plays nothing before the first gesture', () => {
    const d = deps()
    const s = createSound(d)
    s.play('slide')
    expect(d.makeContext).not.toHaveBeenCalled()
    expect(synthCalls).toEqual([])
    expect(room.started).toBe(0)
    s.unlock()
    s.unlock()
    expect(d.makeContext).toHaveBeenCalledTimes(1)
    s.play('slide')
    expect(synthCalls).toEqual(['slide'])
    expect(room.started).toBe(1)
  })

  it('mute is remembered across visits and silences play and the room tone', () => {
    const storage = memoryStorage()
    const a = createSound(deps({ storage }))
    a.unlock()
    a.setMuted(true)
    expect(room.stopped).toBe(1)
    expect(storage.m.get(MUTE_KEY)).toBe('1')
    a.play('drop')
    expect(synthCalls).toEqual([])

    const b = createSound(deps({ storage }))
    expect(b.muted()).toBe(true)
    b.unlock()
    expect(room.started).toBe(1)
    b.setMuted(false)
    expect(room.started).toBe(2)
    b.play('drop')
    expect(synthCalls).toEqual(['drop'])
  })

  it('on by default, and a broken storage does not break sound', () => {
    const bad = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    const s = createSound(deps({ storage: bad }))
    expect(s.muted()).toBe(false)
    s.unlock()
    s.setMuted(true)
    expect(s.muted()).toBe(true)
  })

  it('a missing manifest falls back to placeholders', async () => {
    const s = createSound(deps({ loadManifest: () => Promise.reject(new Error('404')) }))
    s.unlock()
    await Promise.resolve()
    s.play('mark')
    expect(synthCalls).toEqual(['mark'])
  })
})

describe('attachSound', () => {
  function fakeDoc() {
    const handlers = new Map<string, (e: unknown) => void>()
    return {
      addEventListener: (t: string, h: (e: unknown) => void) => handlers.set(t, h),
      removeEventListener: (t: string) => handlers.delete(t),
      fire: (t: string, e: unknown = {}) => handlers.get(t)?.(e),
      handlers,
    }
  }

  it('the first gesture unlocks; store changes then make sounds; training stays silent', () => {
    const brain = createMenace()
    setBeads(brain, '         ', Array(9).fill(0))
    const g = createGame({ brain, rng: seeded(1), lineRng: seeded(2) })
    const s = createSound(deps())
    const doc = fakeDoc()
    const detach = attachSound(g, s, doc as unknown as Document)
    g.getState().start()
    g.getState().think()
    expect(synthCalls).toEqual([])
    doc.fire('pointerdown')
    expect(s.unlocked).toBe(true)
    g.getState().skipLedger()
    g.getState().start()
    g.getState().think()
    expect(synthCalls).toContain('youWin')
    g.getState().skipLedger()
    synthCalls.length = 0
    g.getState().startTraining('random', 5)
    while (g.getState().training !== null) g.getState().trainStep(1000, 1000)
    expect(synthCalls).toEqual([])
    detach()
    expect(doc.handlers.size).toBe(0)
  })
})

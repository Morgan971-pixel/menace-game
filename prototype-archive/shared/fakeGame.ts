// PROTOTYPE: throwaway game state. MENACE plays a random bead here; the real
// learning engine comes later. Only the look and feel of a turn is being tested.
import { create } from 'zustand'

export type Cell = 'X' | 'O' | null
export type Phase = 'title' | 'menace' | 'player' | 'over'
export type Result = 'X' | 'O' | 'draw'

export interface Turn {
  id: number
  box: number
  square: number
  beads: number[] // one entry per bead, value = square it plays
}

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function outcome(b: Cell[]): { result: Result | null; line: number[] | null } {
  for (const l of LINES) {
    const [a, c, d] = l
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { result: b[a] as Result, line: l }
  }
  return b.every(Boolean) ? { result: 'draw', line: null } : { result: null, line: null }
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]

let turnCounter = 0
let placedAt = 0
function makeTurn(board: Cell[]): Turn {
  const empty = board.flatMap((c, i) => (c ? [] : [i]))
  const stage = Math.min(3, Math.floor((9 - empty.length) / 2))
  const per = [4, 3, 2, 1][stage]
  const beads = empty.flatMap((sq) => Array<number>(per).fill(sq))
  for (let i = beads.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[beads[i], beads[j]] = [beads[j], beads[i]]
  }
  return { id: ++turnCounter, box: Math.floor(Math.random() * 304), square: pick(beads), beads }
}

const THINKING = [
  'Box {n}. I have been here before.',
  'Shaking box {n}. Let the beads decide.',
  'Box {n}. Rattle, rattle.',
  'Box {n}. Interesting position.',
]
const ENDINGS: Record<Result, string[]> = {
  X: ['Three more beads for every box I used.', 'As the beads foretold.'],
  O: ['Noted. Those beads are confiscated.', 'A loss. I will not make that move as often.'],
  draw: ['A draw. One bead each. Fair.', 'Stalemate. I am learning your habits.'],
}

interface GameState {
  phase: Phase
  board: Cell[]
  turn: Turn | null
  result: Result | null
  winLine: number[] | null
  score: { menace: number; you: number; draws: number }
  line: string
  showHow: boolean
  start: () => void
  placeMenace: () => void
  playerMove: (i: number) => void
  setShowHow: (v: boolean) => void
}

export const useGame = create<GameState>((set, get) => {
  const beginMenaceTurn = () => {
    const turn = makeTurn(get().board)
    set({ phase: 'menace', turn, line: pick(THINKING).replace('{n}', String(turn.box + 1)) })
  }
  const settle = (board: Cell[]): boolean => {
    const { result, line } = outcome(board)
    if (!result) return false
    const s = { ...get().score }
    if (result === 'X') s.menace++
    else if (result === 'O') s.you++
    else s.draws++
    set({ phase: 'over', result, winLine: line, score: s, line: pick(ENDINGS[result]) })
    return true
  }
  return {
    phase: 'title',
    board: Array<Cell>(9).fill(null),
    turn: null,
    result: null,
    winLine: null,
    score: { menace: 0, you: 0, draws: 0 },
    line: '',
    showHow: false,
    start: () => {
      set({ board: Array<Cell>(9).fill(null), result: null, winLine: null, showHow: false })
      beginMenaceTurn()
    },
    placeMenace: () => {
      const { turn, board, phase } = get()
      if (!turn || phase !== 'menace' || board[turn.square]) return
      const next = board.slice()
      next[turn.square] = 'X'
      placedAt = performance.now()
      set({ board: next })
      if (!settle(next)) set({ phase: 'player', line: 'Your move.' })
    },
    playerMove: (i) => {
      const { board, phase } = get()
      if (phase !== 'player' || board[i]) return
      const next = board.slice()
      next[i] = 'O'
      set({ board: next, phase: 'menace', line: 'Hm.' })
      // let the previous box finish flying home (about 1.3 s after placing) first
      if (!settle(next)) setTimeout(beginMenaceTurn, Math.max(380, 1450 - (performance.now() - placedAt)))
    },
    setShowHow: (v) => set({ showHow: v }),
  }
})

export const HOW_STEPS = [
  { title: 'Shake', body: 'MENACE finds the matchbox for the board in front of it and gives it a shake.' },
  { title: 'Draw', body: 'It pulls out one bead at random. The colour of the bead is the square it plays.' },
  { title: 'Reward', body: 'Win, and the beads it used multiply. Lose, and they are confiscated. Over many games, good moves crowd out bad ones.' },
]

export const RESULT_TITLE: Record<Result, string> = {
  X: 'MENACE wins',
  O: 'You win',
  draw: 'A draw',
}

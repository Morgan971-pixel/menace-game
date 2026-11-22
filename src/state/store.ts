// Game state: a thin zustand layer over the engine.
// Phases: title -> menace <-> player -> ledger -> over.
//
// The store is synchronous. The scene and the turn director (useTurnDirector) decide WHEN
// to call think(), land() and ledgerNext(), so the animation timing never leaks into the rules.
// learn() runs once per game, when the ledger opens; the ledger only replays what it did.
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { winner, type Cell, type Result } from '../engine/board'
import { createMirror, type Mirror } from '../engine/mirror'
import { perfectOpponent, randomOpponent, type Opponent } from '../engine/opponents'
import { playGame } from '../engine/trainer'
import {
  chooseMove,
  createMenace,
  inspect,
  learn,
  type HistoryEntry,
  type Menace,
  type MenaceConfig,
} from '../engine/menace'
import { slotOfKey } from '../engine/slots'
import { clampHistory } from './clamp'
import { inspector } from './inspector'
import { isAllowedConfig, sameConfig, sameShape } from './config'
import type { Rng } from '../engine/rng'
import { addResults, emptyCurve, markLearned, markPlayer, markTinker, startRun, type Curve } from './curve'
import { addLosses, emptyDish, type Dish } from './dish'
import { gamesPlayed, loadSave, noBest, type ChallengeBest, type Saved } from './persist'
import { challengeEndLine, challengeLostLine, challengeStartLine, challengeWonLine, createSay, milestoneLine, streakBrokenLine, rewardsLine, rulesLine, endLine, firstGameLine, forcedLine, importLine, resetLine, openingLine, resignLine, returningLine, summaryLine, thinkLine, trainLine, trainStartLine } from './lines'

export type Phase = 'title' | 'menace' | 'player' | 'ledger' | 'over'

/** Ledger playback speed. Saved with the brain (persist.ts). */
export type Speed = 1 | 2 | 4
export const SPEEDS: readonly Speed[] = [1, 2, 4]

/** A move MENACE drew from a box: what learn() needs, plus what the ledger shows. */
export interface PlayedMove extends HistoryEntry {
  /** Real square played. */
  square: number
  /** Cabinet slot = slotOfKey(boxKey). Box number is slot + 1. */
  slot: number
  /** The real board MENACE faced, before its X. */
  board: Cell[]
}

/** One box in the post-game ledger, in the order MENACE used them. */
export interface LedgerItem {
  /** 'reward': a box that learned. 'resign': the empty box that made MENACE resign (always last). */
  kind: 'reward' | 'resign'
  slot: number
  boxKey: string
  /** Real square played; null for the resign box. */
  square: number | null
  board: Cell[]
  /** Beads per REAL square (inspect on board), before and after learn(). */
  before: (number | null)[]
  after: (number | null)[]
  /** after[square] - before[square]; 0 for the resign box. */
  delta: number
}

export interface MenaceTurn {
  /** Increments every turn, so the scene can key the animation on it. */
  id: number
  square: number
  /** null on the forced move 5, which has no box. */
  boxKey: string | null
  /** Cabinet slot = slotOfKey(boxKey); -1 when forced. Box number is slot + 1. */
  slot: number
  /** Beads per REAL square, read before the draw. null for occupied squares. */
  beads: (number | null)[]
  forced: boolean
  /** Share of the box's beads on the chosen square (1 when forced). */
  sure: number
  /** True once the bead has landed and the X is on the board. */
  landed: boolean
}

export interface Record3 {
  menace: number
  draws: number
  you: number
}

/** MENACE's unbeaten run against the player that counts as "it has learned", and that locks a challenger out. */
export const STREAK_GOAL = 10
/** Wins a challenger needs against the fresh MENACE before it reaches STREAK_GOAL. */
export const CHALLENGE_WINS = 3
/** A streak this long, when the player ends it, earns a line. */
export const BROKEN_MIN = 3

/** The real machine's state, put aside while a challenge borrows the top-level fields. */
export interface MainStash {
  brain: Menace
  record: Record3
  dish: Dish
  dishBefore: Dish
  curve: Curve
  trained: number
  games: number
  streak: number
  learned: boolean
}

/** A challenge in progress or just ended. While it exists, brain, record, dish, curve, games and streak are the CHALLENGE's. */
export interface Challenge {
  stash: MainStash
  /** Set when the challenge ends by a result; null while it is still going. */
  outcome: 'won' | 'lost' | null
}

export type OpponentKind = 'random' | 'perfect' | 'itself'
export const OPPONENT_KINDS: readonly OpponentKind[] = ['random', 'perfect', 'itself']
export const OPPONENT_NAMES: Record<OpponentKind, string> = { random: 'Random', perfect: 'Perfect', itself: 'Itself' }
/** Game counts the Train panel offers. */
export const TRAIN_SIZES: readonly number[] = [10, 100, 1000]
/** Largest run startTraining accepts. */
export const MAX_TRAIN_GAMES = 100_000
/** Games per animation frame at most, so a run is watchable and the page keeps its frame rate. */
export const TRAIN_GAMES_PER_FRAME = 20
/** Newest games of a chunk whose boxes shimmer on the cabinet. */
export const SHIMMER_GAMES = 6
/** Time per frame training may use. */
export const TRAIN_FRAME_MS = 8

/** A training run in progress. Null in GameState when none is. */
export interface TrainRun {
  opponent: OpponentKind
  total: number
  done: number
  /** From MENACE's side. */
  won: number
  drawn: number
  lost: number
  /** Cabinet slots of boxes used in the latest chunk, for the cabinet's shimmer. */
  hot: number[]
}

export interface GameState {
  brain: Menace
  phase: Phase
  board: Cell[]
  turn: MenaceTurn | null
  /** True while the active box is out of the cabinet (set by think, cleared by boxHome). */
  boxOut: boolean
  history: PlayedMove[]
  /** From MENACE's side: 'X' it won, 'O' it lost (or resigned), 'D' draw. */
  result: Result | null
  resigned: boolean
  winLine: readonly number[] | null
  record: Record3
  speech: string
  /** True when the opening line was a greeting (first game ever, or back after a reload): the director waits longer so it can be read. */
  greeted: boolean
  games: number
  /** The boxes of the game just played, built when the game ends. */
  ledger: LedgerItem[]
  /** Item being shown: -1 before the first box comes out, ledger.length once closed. */
  ledgerAt: number
  speed: Speed
  /** The dish of confiscated beads, including the game just played (counted when the game ends). */
  dish: Dish
  /** The dish as it was before the game just played; the ledger replay builds on it. */
  dishBefore: Dish
  /** False once the browser refused a save (full or blocked storage). */
  saveOk: boolean
  /** MENACE's results over every game, the player's and training. */
  curve: Curve
  /** Games MENACE played in training. `games` stays the player's games. */
  trained: number
  /** Set while a training run is going. Games and Play are locked until it ends. */
  training: TrainRun | null
  /** MENACE's unbeaten run (wins and draws) against the player. Training never counts. */
  streak: number
  /** True once "it has learned" fired for this brain. */
  learned: boolean
  /** Counts the times the "it has learned" beat has played; the scene reacts to a change. */
  milestone: number
  /** Set when the game that just ended earned the milestone; the beat and the line wait for the ledger to close. */
  milestoneDue: boolean
  /** The streak length the player just ended, when long enough for a line (else 0). */
  broke: number
  /** Set while a challenge against a fresh MENACE is on. */
  challenge: Challenge | null
  /** Fewest games to win a challenge and longest survival. */
  challengeBest: ChallengeBest

  start: () => void
  /** MENACE picks its move (or resigns). Only acts in the menace phase with no pending turn. */
  think: () => void
  /** The drawn bead has reached the board: place the X. */
  land: () => void
  /** The player places O on square i (0 = top-left). */
  play: (i: number) => void
  boxHome: () => void
  /** Item `from` is done: show the next one, or close the ledger after the last. Stale calls are ignored. */
  ledgerNext: (from: number) => void
  /** Close the ledger now. Same end state as watching it through. */
  skipLedger: () => void
  setSpeed: (speed: Speed) => void
  /** Fresh brain under the current settings, zero record, empty dish. Only on the title screen or game over. Returns whether it ran. */
  resetBrain: () => boolean
  /**
   * Tinker: applies new settings. A new rule set or new starting beads needs a fresh brain, so it
   * wipes the memory, record, curve and dish like a reset. Changing only the rewards keeps the
   * brain (learn() reads the rewards from the config each game). Refuses an out-of-range config,
   * mid-game, and during training. Returns whether it ran.
   */
  applyConfig: (config: MenaceConfig) => boolean
  /** Replaces the brain and keeps the record. Only on the title screen or game over. Returns whether it ran. */
  importBrain: (brain: Menace) => boolean
  /** Begins a training run of n games. Only on the title screen or game over, one run at a time. Returns whether it began. */
  startTraining: (opponent: OpponentKind, n: number) => boolean
  /**
   * Plays the next chunk of the run: until the frame budget or maxGames, whichever comes first
   * (always at least one game). Every game is whole, so the brain and the curve are consistent after any call.
   */
  trainStep: (budgetMs?: number, maxGames?: number) => void
  /** Ends the run where it stands. Keeps everything learned so far. */
  stopTraining: () => void
  /** Starts a challenge against a fresh 1961 MENACE and its first game. Only between games. Returns whether it began. */
  startChallenge: () => boolean
  /** Puts the real machine back, to the title. Only between challenge games or after its result. Returns whether it ran. */
  endChallenge: () => boolean
}

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function winningLine(cells: readonly Cell[]): readonly number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line
    if (cells[a] !== null && cells[a] === cells[b] && cells[a] === cells[c]) return line
  }
  return null
}

const emptyBoard = (): Cell[] => Array<Cell>(9).fill(null)

export interface GameOptions {
  brain?: Menace
  /** Drives MENACE's bead draws. */
  rng?: Rng
  /** Picks which line MENACE says. */
  lineRng?: Rng
  /** Restored from a save: brain, record, dish and speed. `brain` above wins if both are given. */
  saved?: Saved
}

export function createGame(options: GameOptions = {}): StoreApi<GameState> {
  const rng = options.rng ?? Math.random
  const lineRng = options.lineRng ?? Math.random
  const pick = createSay(lineRng)
  // True once a game has begun since this page loaded.
  let startedHere = false
  const saved = options.saved
  let turnId = 0
  // The "Itself" opponent keeps learning across runs until the brain is reset or replaced.
  let mirror: Mirror | null = null
  const opponentFor = (kind: OpponentKind): Opponent => {
    if (kind === 'random') return randomOpponent
    if (kind === 'perfect') return perfectOpponent
    mirror ??= createMirror()
    return mirror
  }

  return createStore<GameState>()((set, get) => {
    /**
     * Ends the game and opens the ledger. learn() runs here and nowhere else, once per game.
     * resignBox: the empty box that made MENACE resign, shown as the ledger's last item.
     */
    const finish = (result: Result, board: Cell[], speech: string, resignBox: string | null = null) => {
      const { brain, history, record, phase, dish, streak: prevStreak, learned, challenge, challengeBest } = get()
      if (phase !== 'menace' && phase !== 'player') return
      const before = history.map((h) => inspect(brain, h.board).beads)
      learn(brain, history, result)
      clampHistory(brain, history)
      const ledger: LedgerItem[] = history.map((h, i) => {
        const after = inspect(brain, h.board).beads
        return {
          kind: 'reward', slot: h.slot, boxKey: h.boxKey, square: h.square, board: h.board,
          before: before[i], after, delta: (after[h.square] ?? 0) - (before[i][h.square] ?? 0),
        }
      })
      if (resignBox !== null) {
        const beads = inspect(brain, board).beads
        ledger.push({
          kind: 'resign', slot: slotOfKey(resignBox), boxKey: resignBox, square: null,
          board: board.slice(), before: beads, after: beads.slice(), delta: 0,
        })
      }
      const nextRecord = {
        menace: record.menace + (result === 'X' ? 1 : 0),
        draws: record.draws + (result === 'D' ? 1 : 0),
        you: record.you + (result === 'O' ? 1 : 0),
      }
      const games = get().games + 1
      // Wins and draws in a row; a player win (or a resign) ends it. Only the player's games reach here.
      const streak = result === 'O' ? 0 : prevStreak + 1
      // A challenge ends on the player's third win, or when the fresh machine reaches the goal streak.
      const outcome: Challenge['outcome'] =
        challenge === null ? null : nextRecord.you >= CHALLENGE_WINS ? 'won' : streak >= STREAK_GOAL ? 'lost' : null
      // The real machine's milestone. A challenge brain never earns it.
      const fires = challenge === null && !learned && streak >= STREAK_GOAL
      let curve = addResults(markPlayer(get().curve), [result])
      if (fires) curve = markLearned(curve)
      set({
        phase: 'ledger',
        board,
        result,
        resigned: resignBox !== null,
        winLine: winningLine(board),
        record: nextRecord,
        games,
        streak,
        learned: learned || fires,
        milestoneDue: fires,
        broke: result === 'O' && prevStreak >= BROKEN_MIN ? prevStreak : 0,
        ...(challenge !== null && outcome !== null
          ? {
              challenge: { ...challenge, outcome },
              challengeBest:
                outcome === 'won'
                  ? { ...challengeBest, won: challengeBest.won === null ? games : Math.min(challengeBest.won, games) }
                  : { ...challengeBest, survived: Math.max(challengeBest.survived, games) },
            }
          : {}),
        // A player game after a training run marks where the player's games resume.
        curve,
        speech,
        ledger,
        ledgerAt: -1,
        dishBefore: dish,
        dish: addLosses(dish, ledger),
      })
    }

    /** Ledger -> over. The only way out of the ledger, whether it was watched or skipped. Only flips the phase: learn, the record and the dish were settled when the game ended. */
    const closeLedger = () => {
      const { phase, ledger, result, challenge, milestoneDue, broke } = get()
      if (phase !== 'ledger' || result === null) return
      const resignItem = ledger.find((i) => i.kind === 'resign')
      const summary = () =>
        summaryLine(pick, {
          result,
          boxes: ledger.filter((i) => i.kind === 'reward').length,
          beads: ledger.reduce((sum, i) => sum + Math.abs(i.delta), 0),
          resignBox: resignItem ? resignItem.slot + 1 : null,
        })
      // One last word per game, most important first.
      const speech =
        challenge?.outcome === 'won' ? challengeWonLine(pick)
        : challenge?.outcome === 'lost' ? challengeLostLine(pick)
        : milestoneDue ? milestoneLine(pick)
        : broke > 0 ? streakBrokenLine(pick)
        : summary()
      set({
        phase: 'over',
        ledgerAt: ledger.length,
        speech,
        // The beat plays once, as the books close.
        ...(milestoneDue ? { milestone: get().milestone + 1, milestoneDue: false } : {}),
      })
    }

    return {
      brain: options.brain ?? saved?.brain ?? createMenace(),
      phase: 'title',
      board: emptyBoard(),
      turn: null,
      boxOut: false,
      history: [],
      result: null,
      resigned: false,
      winLine: null,
      record: saved ? { ...saved.record } : { menace: 0, draws: 0, you: 0 },
      speech: '',
      greeted: false,
      games: saved ? gamesPlayed(saved.record) : 0,
      ledger: [],
      ledgerAt: -1,
      speed: saved?.speed ?? 1,
      dish: saved ? saved.dish : emptyDish(),
      dishBefore: saved ? saved.dish : emptyDish(),
      saveOk: true,
      curve: saved ? saved.curve : emptyCurve(),
      trained: saved ? saved.trained : 0,
      training: null,
      streak: saved?.streak ?? 0,
      learned: saved?.learned ?? false,
      milestone: 0,
      milestoneDue: false,
      broke: 0,
      challenge: null,
      challengeBest: saved?.challengeBest ?? noBest(),

      start: () => {
        const { phase: p, training, challenge } = get()
        if (p === 'menace' || p === 'player' || p === 'ledger' || training !== null) return
        // A finished challenge has its result on screen; only End challenge leaves it.
        if (challenge !== null && challenge.outcome !== null) return
        const first = get().games === 0
        const back = !first && !startedHere
        startedHere = true
        set({
          phase: 'menace',
          board: emptyBoard(),
          turn: null,
          boxOut: false,
          history: [],
          result: null,
          resigned: false,
          winLine: null,
          ledger: [],
          ledgerAt: -1,
          greeted: first || back,
          speech: first ? firstGameLine(pick) : back ? returningLine(pick, get().games) : openingLine(pick),
        })
      },

      think: () => {
        const { phase, turn, board, brain } = get()
        if (phase !== 'menace' || (turn !== null && !turn.landed)) return
        if (winner(board) !== null) return
        const before = inspect(brain, board)
        const choice = chooseMove(brain, board, rng)
        if (choice.kind === 'resign') {
          const slot = slotOfKey(choice.boxKey)
          finish('O', board, resignLine(pick, slot + 1), choice.boxKey)
          return
        }
        if (choice.forced) {
          set({
            turn: {
              id: ++turnId, square: choice.square, boxKey: null, slot: -1,
              beads: before.beads, forced: true, sure: 1, landed: false,
            },
            speech: forcedLine(pick),
          })
          return
        }
        const boxKey = choice.entry?.boxKey ?? before.boxKey
        if (boxKey === null) throw new Error('think: a non-forced move must come from a box')
        const slot = slotOfKey(boxKey)
        const total = before.beads.reduce<number>((sum, b) => sum + (b ?? 0), 0)
        const sure = total > 0 ? (before.beads[choice.square] ?? 0) / total : 0
        set({
          turn: {
            id: ++turnId, square: choice.square, boxKey, slot,
            beads: before.beads, forced: false, sure, landed: false,
          },
          boxOut: true,
          // Recorded now, so a game that ends on this move learns it.
          history: choice.entry
            ? [...get().history, { ...choice.entry, square: choice.square, slot, board: board.slice() }]
            : get().history,
          speech: thinkLine(pick, slot + 1, sure),
        })
      },

      land: () => {
        const { phase, turn, board, history } = get()
        if (phase !== 'menace' || turn === null || turn.landed) return
        const next = board.slice()
        next[turn.square] = 'X'
        set({ board: next, turn: { ...turn, landed: true } })
        const result = winner(next)
        if (result !== null) finish(result, next, endLine(pick, result, history.length))
        else set({ phase: 'player' })
      },

      play: (i) => {
        const { phase, board, history } = get()
        if (phase !== 'player' || !Number.isInteger(i) || i < 0 || i > 8 || board[i] !== null) return
        const next = board.slice()
        next[i] = 'O'
        const result = winner(next)
        if (result !== null) finish(result, next, endLine(pick, result, history.length))
        else set({ board: next, phase: 'menace' })
      },

      boxHome: () => set({ boxOut: false }),

      ledgerNext: (from) => {
        const { phase, ledgerAt, ledger } = get()
        if (phase !== 'ledger' || ledgerAt !== from) return
        if (from + 1 < ledger.length) set({ ledgerAt: from + 1 })
        else closeLedger()
      },

      skipLedger: closeLedger,

      setSpeed: (speed) => {
        if (SPEEDS.includes(speed)) set({ speed })
      },

      resetBrain: () => {
        const { phase: p, training, challenge } = get()
        if ((p !== 'title' && p !== 'over') || training !== null || challenge !== null) return false
        mirror = null
        inspector.getState().close()
        set({
          brain: createMenace(get().brain.config),
          record: { menace: 0, draws: 0, you: 0 },
          streak: 0,
          learned: false,
          milestoneDue: false,
          broke: 0,
          games: 0,
          curve: emptyCurve(),
          trained: 0,
          dish: emptyDish(),
          dishBefore: emptyDish(),
          speech: resetLine(pick),
        })
        return true
      },

      applyConfig: (config) => {
        const { phase: p, training, brain: old, challenge } = get()
        if ((p !== 'title' && p !== 'over') || training !== null || challenge !== null) return false
        if (!isAllowedConfig(config) || sameConfig(old.config, config)) return false
        if (sameShape(old.config, config)) {
          // Rewards only: the same boxes under a new config object. The old brain object is left alone.
          set({ curve: markTinker(get().curve), brain: { config: { ...config, startBeads: [...config.startBeads], rewards: { ...config.rewards } }, boxes: old.boxes }, speech: rewardsLine(pick) })
          return true
        }
        mirror = null
        inspector.getState().close()
        set({
          brain: createMenace(config),
          record: { menace: 0, draws: 0, you: 0 },
          streak: 0,
          learned: false,
          milestoneDue: false,
          broke: 0,
          games: 0,
          curve: emptyCurve(),
          trained: 0,
          dish: emptyDish(),
          dishBefore: emptyDish(),
          speech: config.rules !== old.config.rules ? rulesLine(pick, config.rules) : resetLine(pick),
        })
        return true
      },

      importBrain: (brain) => {
        const { phase: p, training, challenge } = get()
        if ((p !== 'title' && p !== 'over') || training !== null || challenge !== null) return false
        mirror = null
        inspector.getState().close()
        // The curve described the old brain, so the imported one starts a fresh curve. The record stays.
        // A different brain has not learned this player yet: its streak and milestone start over.
        set({ brain, curve: emptyCurve(), trained: 0, streak: 0, learned: false, milestoneDue: false, broke: 0, speech: importLine(pick, brain.boxes.size) })
        return true
      },

      startTraining: (kind, n) => {
        const { phase: p, training, challenge } = get()
        if ((p !== 'title' && p !== 'over') || training !== null || challenge !== null) return false
        if (!OPPONENT_KINDS.includes(kind) || !Number.isInteger(n) || n < 1 || n > MAX_TRAIN_GAMES) return false
        set({
          curve: startRun(get().curve, kind),
          training: { opponent: kind, total: n, done: 0, won: 0, drawn: 0, lost: 0, hot: [] },
          speech: trainStartLine(pick, OPPONENT_NAMES[kind], n),
        })
        return true
      },

      trainStep: (budgetMs = TRAIN_FRAME_MS, maxGames = TRAIN_GAMES_PER_FRAME) => {
        const { training: run, brain, curve } = get()
        if (run === null) return
        const opponent = opponentFor(run.opponent)
        const results: Result[] = []
        // Histories of the newest games in this chunk, for the cabinet's shimmer.
        const recent: (readonly HistoryEntry[])[] = []
        const started = performance.now()
        let { won, drawn, lost } = run
        while (
          run.done + results.length < run.total &&
          results.length < maxGames &&
          (results.length === 0 || performance.now() - started < budgetMs)
        ) {
          const g = playGame(brain, opponent, rng)
          clampHistory(brain, g.history)
          results.push(g.result)
          if (g.result === 'X') won++
          else if (g.result === 'D') drawn++
          else lost++
          recent.push(g.history)
          if (recent.length > SHIMMER_GAMES) recent.shift()
        }
        const used = recent.flatMap((history) => history.map((h) => slotOfKey(h.boxKey)))
        const done = run.done + results.length
        const next: TrainRun = { ...run, done, won, drawn, lost, hot: used }
        const patch = { curve: addResults(curve, results), trained: get().trained + results.length }
        if (done >= run.total) {
          set({ ...patch, training: null, speech: trainLine(pick, OPPONENT_NAMES[run.opponent], next, false) })
        } else set({ ...patch, training: next })
      },

      stopTraining: () => {
        const run = get().training
        if (run === null) return
        set({ training: null, speech: trainLine(pick, OPPONENT_NAMES[run.opponent], run, true) })
      },

      startChallenge: () => {
        const s = get()
        if ((s.phase !== 'title' && s.phase !== 'over') || s.training !== null || s.challenge !== null) return false
        inspector.getState().close()
        const stash: MainStash = {
          brain: s.brain, record: s.record, dish: s.dish, dishBefore: s.dishBefore, curve: s.curve,
          trained: s.trained, games: s.games, streak: s.streak, learned: s.learned,
        }
        // The challenge borrows the top-level fields with a fresh 1961 brain; the real ones wait in the stash.
        set({
          challenge: { stash, outcome: null },
          brain: createMenace(),
          record: { menace: 0, draws: 0, you: 0 },
          games: 0,
          dish: emptyDish(),
          dishBefore: emptyDish(),
          curve: emptyCurve(),
          trained: 0,
          streak: 0,
          learned: false,
          milestoneDue: false,
          broke: 0,
        })
        get().start()
        set({ speech: challengeStartLine(pick) })
        return true
      },

      endChallenge: () => {
        const { challenge, phase, training } = get()
        if (challenge === null || phase !== 'over' || training !== null) return false
        inspector.getState().close()
        set({
          ...challenge.stash,
          challenge: null,
          phase: 'title',
          board: emptyBoard(),
          turn: null,
          boxOut: false,
          history: [],
          result: null,
          resigned: false,
          winLine: null,
          ledger: [],
          ledgerAt: -1,
          milestoneDue: false,
          broke: 0,
          speech: challengeEndLine(pick),
        })
        return true
      },
    }
  })
}

/** The app's one game. */
export const game = createGame({ saved: loadSave() ?? undefined })

export function useGame<T>(selector: (s: GameState) => T): T {
  return useStore(game, selector)
}

/** Keeps window.__menace = { phase, board } in sync for the visual gate. Returns an unsubscribe. */
export function exposeForGate(store: StoreApi<GameState> = game): () => void {
  const w = window as unknown as { __menace?: { phase: Phase; board: Cell[] }; __game?: StoreApi<GameState> }
  // Dev server only: lets look-and-fix sessions drive the game from the console.
  if (import.meta.env.DEV) w.__game = store
  const sync = (s: GameState) => {
    w.__menace = { phase: s.phase, board: s.board }
  }
  sync(store.getState())
  return store.subscribe(sync)
}

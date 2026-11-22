// First-visit tips: one hint at the box coming out of the cabinet, one at the player's first turn.
// They show for a visitor's first game only. "Seen" lives in its own small key, and every storage
// access is wrapped, so a browser that refuses storage just shows the tips again next visit.
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { defaultStorage, type StorageLike } from './persist'
import type { GameState } from './store'

export const TIPS_KEY = 'menace.tips.v1'

export interface TipsState {
  /** True until the first game ends, and again after "Show tips again". */
  on: boolean
  /** This game's box tip has been shown or dismissed. */
  boxDone: boolean
  /** This game's turn tip has been shown or dismissed. */
  turnDone: boolean
  dismissBox: () => void
  dismissTurn: () => void
  /** The Machine menu option: tips return for the next game. */
  showAgain: () => void
  /** A new game began: this game's tips are fresh again. */
  gameStarted: () => void
  /** The first game ended: remember it and stop. */
  gameEnded: () => void
}

function readSeen(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(TIPS_KEY) === 'seen'
  } catch {
    return false
  }
}

function writeSeen(storage: StorageLike | null, seen: boolean): void {
  try {
    if (seen) storage?.setItem(TIPS_KEY, 'seen')
    else storage?.removeItem(TIPS_KEY)
  } catch {
    // Not remembered; the tips return next visit.
  }
}

export function createTips(storage: StorageLike | null = defaultStorage()): StoreApi<TipsState> {
  return createStore<TipsState>()((set, get) => ({
    on: !readSeen(storage),
    boxDone: false,
    turnDone: false,
    dismissBox: () => set({ boxDone: true }),
    dismissTurn: () => set({ turnDone: true }),
    showAgain: () => {
      writeSeen(storage, false)
      set({ on: true, boxDone: false, turnDone: false })
    },
    gameStarted: () => set({ boxDone: false, turnDone: false }),
    gameEnded: () => {
      if (!get().on) return
      writeSeen(storage, true)
      set({ on: false })
    },
  }))
}

/**
 * Ties the tips to the game: fresh at each start, the box tip is spent once the box is home, the
 * turn tip once the player has moved, and the first finished game switches tips off. Returns an unsubscribe.
 */
export function bindTips(tips: StoreApi<TipsState>, game: StoreApi<GameState>): () => void {
  let prev = game.getState()
  return game.subscribe((s) => {
    const was = prev
    prev = s
    const t = tips.getState()
    if (s.phase === 'menace' && (was.phase === 'title' || was.phase === 'over')) t.gameStarted()
    if (was.boxOut && !s.boxOut) t.dismissBox()
    if (was.phase === 'player' && s.phase !== 'player') t.dismissTurn()
    if (s.phase === 'ledger' && was.phase !== 'ledger') t.gameEnded()
  })
}

/** The app's tips. */
export const tips = createTips()

export function useTips<T>(selector: (s: TipsState) => T): T {
  return useStore(tips, selector)
}

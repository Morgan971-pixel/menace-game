// Paces MENACE's turns. The store says what happens; this decides when.
//   - A new MENACE turn starts once the previous box is back in the cabinet, after a short pause.
//   - The forced move 5 has no box, so its X lands after a beat instead of after a bead flight.
//   - A normal turn's X lands when ActiveBox's bead reaches the board.
//   - Fallbacks: if the animation stalls (hidden tab, lost WebGL context), the X lands and the
//     box counts as home a few seconds after they should have, so the game cannot hang.
import { useEffect } from 'react'
import { HOME_AT_S, LAND_AT_S, LEDGER_ITEM_S } from '../scene/timing'
import { inspector, useInspector } from '../state/inspector'
import { game, useGame } from '../state/store'

const FIRST_PAUSE_MS = 250
/** After a greeting (first game, or back after a reload): long enough to read it. */
const GREETED_PAUSE_MS = 1500
const NEXT_PAUSE_MS = 450
const FORCED_BEAT_MS = 900
const STALL_GRACE_MS = 3000
const LAND_FALLBACK_MS = LAND_AT_S * 1000 + STALL_GRACE_MS
const HOME_FALLBACK_MS = HOME_AT_S * 1000 + STALL_GRACE_MS

export function useTurnDirector() {
  const phase = useGame((s) => s.phase)
  const turn = useGame((s) => s.turn)
  const boxOut = useGame((s) => s.boxOut)
  const greeted = useGame((s) => s.greeted)

  useEffect(() => {
    if (phase !== 'menace') return
    if (turn !== null && !turn.landed) {
      // land() ignores a second call, so the fallback is harmless when the animation is on time.
      const t = window.setTimeout(() => game.getState().land(), turn.forced ? FORCED_BEAT_MS : LAND_FALLBACK_MS)
      return () => window.clearTimeout(t)
    }
    if (boxOut) return
    const t = window.setTimeout(() => game.getState().think(), turn === null ? (greeted ? GREETED_PAUSE_MS : FIRST_PAUSE_MS) : NEXT_PAUSE_MS)
    return () => window.clearTimeout(t)
  }, [phase, turn, boxOut, greeted])

  // The box's trip home is timed from when it left (the turn id), whatever the phase is now.
  const turnId = turn?.id ?? null
  useEffect(() => {
    if (!boxOut || turnId === null) return
    const t = window.setTimeout(() => {
      const s = game.getState()
      if (s.boxOut && s.turn?.id === turnId) s.boxHome()
    }, HOME_FALLBACK_MS)
    return () => window.clearTimeout(t)
  }, [boxOut, turnId])
}

/** Keys 1 to 9 place O; 1 is top-left. */
export function useNumberKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (/^[1-9]$/.test(e.key)) game.getState().play(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const LEDGER_FIRST_PAUSE_MS = 400

/**
 * Paces the post-game ledger. The first box comes out once the last turn's box is home. Each
 * LedgerBox reports itself done through ledgerNext; if the animation stalls, a timer does it
 * a few seconds late, so the ledger cannot hang. The speed setting scales both.
 */
export function useLedgerDirector() {
  const phase = useGame((s) => s.phase)
  const ledgerAt = useGame((s) => s.ledgerAt)
  const boxOut = useGame((s) => s.boxOut)
  const speed = useGame((s) => s.speed)
  // An open inspector holds the ledger where it is (LedgerBox stops too); closing re-arms the timers.
  const held = useInspector((s) => s.slot !== null)

  useEffect(() => {
    if (phase !== 'ledger' || held) return
    if (ledgerAt === -1) {
      if (boxOut) return
      const t = window.setTimeout(() => game.getState().ledgerNext(-1), LEDGER_FIRST_PAUSE_MS / speed)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => game.getState().ledgerNext(ledgerAt), (LEDGER_ITEM_S * 1000) / speed + STALL_GRACE_MS)
    return () => window.clearTimeout(t)
  }, [phase, ledgerAt, boxOut, speed, held])
}

/** Space, Enter and Escape skip the ledger. A focused button keeps its own Space and Enter. */
export function useLedgerKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || game.getState().phase !== 'ledger' || inspector.getState().slot !== null) return
      if (e.key !== 'Escape' && e.key !== ' ' && e.key !== 'Enter') return
      const el = document.activeElement
      if (e.key !== 'Escape' && el instanceof HTMLElement && el.closest('button, a, input, textarea')) return
      e.preventDefault()
      if (!e.repeat) game.getState().skipLedger()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

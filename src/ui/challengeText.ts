import { CHALLENGE_WINS, STREAK_GOAL } from '../state/store'
import type { ChallengeBest } from '../state/persist'

/** The saved challenge result, in one line. */
export function bestLine(best: ChallengeBest): string {
  if (best.won !== null) return `Best: ${CHALLENGE_WINS} wins in ${best.won} games.`
  if (best.survived > 0) return `Best so far: ${best.survived} games before the lock. Win ${CHALLENGE_WINS} before it goes ${STREAK_GOAL} unbeaten.`
  return ''
}

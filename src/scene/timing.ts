// The timeline of one animated MENACE turn, in seconds from when the box starts to move.
// Shared by ActiveBox (which plays it) and the turn director (which has a fallback if it stalls).
export const TURN_TIMELINE = {
  out: [0, 0.75],
  open: [0.75, 1.1],
  shake: [1.35, 1.95],
  bead: [2.0, 2.85],
  close: [3.1, 3.45],
  back: [3.45, 4.1],
} as const

/** The bead reaches the board and the X lands. */
export const LAND_AT_S = TURN_TIMELINE.bead[1]
/** The box is back in its slot. */
export const HOME_AT_S = TURN_TIMELINE.back[1]

/**
 * One ledger item at 1x, in seconds. The scene plays it at speed x (game time = real time x speed).
 * `act` is where the beads move: drops in on a win or draw, the drawn bead to the dish on a loss.
 */
export const LEDGER_TIMELINE = {
  out: [0, 0.5],
  open: [0.3, 0.62],
  act: 0.65,
  close: [1.35, 1.55],
  back: [1.45, 1.8],
} as const

/** Seconds of one ledger item at 1x. */
export const LEDGER_ITEM_S = LEDGER_TIMELINE.back[1]

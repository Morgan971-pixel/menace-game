// prefers-reduced-motion, read live. When set, MENACE's turn and the ledger play faster
// (MOTION_REDUCED_RATE) and the box is not shaken; sounds are re-timed to match.
export const MOTION_REDUCED_RATE = 2.5

const query = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null

export const reducedMotion = (): boolean => query?.matches === true

/** Multiplier on animation time: 1 normally, faster when motion is reduced. */
export const motionRate = (): number => (reducedMotion() ? MOTION_REDUCED_RATE : 1)

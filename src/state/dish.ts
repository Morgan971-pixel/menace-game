// The dish of confiscated beads, kept small: nine per-colour counts (colour = real square)
// plus the last 48 squares, which are the only beads the scene draws. Nothing here is ever
// sized by a bead count, so a huge delta can neither allocate nor throw.

/** Beads the dish draws: the newest ones. */
export const DISH_TAIL = 48
/** Per-colour counts stop here, far beyond anything a real game reaches. */
export const MAX_DISH_COUNT = 1_000_000_000

export interface Dish {
  /** Beads confiscated per real square (0 to 8). */
  counts: number[]
  /** The last DISH_TAIL confiscated squares, oldest first. */
  tail: number[]
}

export const emptyDish = (): Dish => ({ counts: Array<number>(9).fill(0), tail: [] })

export function dishTotal(d: Dish): number {
  return d.counts.reduce((sum, c) => sum + c, 0)
}

/** A new dish with `n` more beads on `square`. Ignores n <= 0 and non-integers. */
export function addToDish(d: Dish, square: number, n: number): Dish {
  if (!Number.isInteger(square) || square < 0 || square > 8 || !(n >= 1)) return { counts: d.counts.slice(), tail: d.tail.slice() }
  const counts = d.counts.slice()
  counts[square] = Math.min(MAX_DISH_COUNT, counts[square] + Math.floor(Math.min(n, MAX_DISH_COUNT)))
  const tail = d.tail.slice(-DISH_TAIL)
  for (let i = 0; i < Math.min(Math.floor(n), DISH_TAIL); i++) tail.push(square)
  return { counts, tail: tail.slice(-DISH_TAIL) }
}

const isSquare = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 8

/** Reads a saved dish: the current shape, the old list of squares, or anything else (empty). Clamps, never throws. */
export function parseDish(v: unknown): Dish {
  if (Array.isArray(v)) {
    // Old saves: every confiscated square in order.
    const counts = Array<number>(9).fill(0)
    for (const q of v) if (isSquare(q)) counts[q] = Math.min(MAX_DISH_COUNT, counts[q] + 1)
    return { counts, tail: v.filter(isSquare).slice(-DISH_TAIL) }
  }
  if (typeof v !== 'object' || v === null) return emptyDish()
  const { counts: rawCounts, tail: rawTail } = v as { counts?: unknown; tail?: unknown }
  const counts = Array<number>(9).fill(0)
  if (Array.isArray(rawCounts)) {
    for (let i = 0; i < 9; i++) {
      const c = rawCounts[i]
      if (typeof c === 'number' && Number.isInteger(c) && c >= 0) counts[i] = Math.min(c, MAX_DISH_COUNT)
    }
  }
  const tail = Array.isArray(rawTail) ? rawTail.filter(isSquare).slice(-DISH_TAIL) : []
  return { counts, tail }
}

/** The dish after the losses in `items` (each item with a negative delta confiscates -delta beads of its square). */
export function addLosses(d: Dish, items: readonly { square: number | null; delta: number }[]): Dish {
  let out = d
  for (const i of items) if (i.square !== null && i.delta < 0) out = addToDish(out, i.square, -i.delta)
  return out
}

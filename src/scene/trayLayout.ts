// How the presented box shows its beads. Pure, so it is unit-tested.
//
// The tray shows the box's TRUE bead count per colour (one colour per real square): every bead
// is drawn, packed tighter as the box fills, up to TRAY_CAP beads. Only a box holding more than
// that is scaled down (proportions kept as exact as integers allow, at least one bead per square
// that has any), and then each colour also gets a tag with its true count.
// Beads are grouped by square and laid out front row first, so the colour mix reads at a glance.

/** Every box with up to this many beads is drawn bead for bead. */
export const TRAY_CAP = 90

/** Usable tray floor, in box units: width across, and depth from the drawer front backwards
 * to the last row that is still outside the sleeve when the tray is open. */
const INNER_W = 0.5
const INNER_D = 0.62
/** Inner face of the drawer front, tray-local z. */
const FRONT_Z = 0.425
const MAX_PITCH = 0.098
const MIN_PITCH = 0.055
/** Bead radius as a share of the spacing between bead centres. */
const RADIUS_RATIO = 0.44
/** Grid sizes the tray steps through. A box keeps the same grid while its count moves within a
 * tier, so a bead gained or lost changes one colour group instead of reflowing the whole tray. */
const GRID_TIERS = [30, 42, 56, 72, TRAY_CAP] as const

export interface TrayBead {
  square: number
  x: number
  z: number
}

export interface TrayTag {
  square: number
  /** The real number of beads of this colour in the box. */
  count: number
}

export interface TrayLayout {
  beads: TrayBead[]
  /** Bead radius, box units. */
  radius: number
  pitch: number
  /** True when the box holds more than TRAY_CAP beads and the drawing is scaled down. */
  scaled: boolean
  /** True count per colour present, shown as a legend on the tray; only filled when scaled. */
  tags: TrayTag[]
}

const counts = (beads: readonly (number | null)[]) => beads.map((b) => Math.max(0, b ?? 0))
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)

/** Number of beads to draw per real square: the real counts when they fit, else scaled to `cap`. */
export function beadsToDraw(beads: readonly (number | null)[], cap = TRAY_CAP): number[] {
  const real = counts(beads)
  const total = sum(real)
  if (total <= cap) return real
  const present = real.filter((c) => c > 0).length
  if (present >= cap) {
    // More colours than room (only with a tiny cap): one bead each for the first squares.
    let room = cap
    return real.map((c) => (c > 0 && room-- > 0 ? 1 : 0))
  }
  // Largest remainder on the exact shares, with a floor of one bead per colour present.
  const exact = real.map((c) => (c * cap) / total)
  const out = real.map((c, i) => (c > 0 ? Math.max(1, Math.floor(exact[i])) : 0))
  let left = cap - sum(out)
  const byRemainder = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .filter(({ i }) => real[i] > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; left > 0; k = (k + 1) % byRemainder.length, left--) out[byRemainder[k].i]++
  // Floors of one can overshoot: take back from the squares furthest above their exact share.
  while (left < 0) {
    let worst = -1
    for (let i = 0; i < out.length; i++) {
      if (out[i] > 1 && (worst < 0 || out[i] - exact[i] > out[worst] - exact[worst])) worst = i
    }
    out[worst]--
    left++
  }
  return out
}

/** Largest bead spacing whose grid holds n beads (never below MIN_PITCH). */
export function trayGrid(n: number): { cols: number; rows: number; pitch: number } {
  for (let p = MAX_PITCH; p > MIN_PITCH; p -= 0.001) {
    const cols = Math.floor(INNER_W / p + 1e-9)
    const rows = Math.floor(INNER_D / p + 1e-9)
    if (cols * rows >= n) return { cols, rows, pitch: p }
  }
  return {
    cols: Math.floor(INNER_W / MIN_PITCH + 1e-9),
    rows: Math.floor(INNER_D / MIN_PITCH + 1e-9),
    pitch: MIN_PITCH,
  }
}

/** Positions for the drawn beads, grouped by square, front row first. */
export function trayLayout(beads: readonly (number | null)[], cap = TRAY_CAP): TrayLayout {
  const real = counts(beads)
  const draw = beadsToDraw(beads, cap)
  const scaled = sum(real) > cap
  const n = sum(draw)
  const { cols, pitch } = trayGrid(GRID_TIERS.find((tier) => tier >= n) ?? n)
  const radius = pitch * RADIUS_RATIO
  const spot = (idx: number) => ({
    x: ((idx % cols) - (cols - 1) / 2) * pitch,
    z: FRONT_Z - pitch / 2 - Math.floor(idx / cols) * pitch,
  })
  const out: TrayBead[] = []
  const tags: TrayTag[] = []
  draw.forEach((n, square) => {
    if (scaled && n > 0) tags.push({ square, count: real[square] })
    for (let k = 0; k < n; k++) out.push({ square, ...spot(out.length) })
  })
  return { beads: out, radius, pitch, scaled, tags }
}

/** Index of the bead that gets drawn: the front-most bead of the chosen square. */
export function drawnIndex(beads: readonly TrayBead[], square: number): number {
  return beads.findIndex((b) => b.square === square)
}

/** One bead of the ledger animation: where it starts and where it ends, tray-local. */
export interface TrayMove {
  square: number
  /** null: the bead is new (it drops in). */
  from: { x: number; z: number } | null
  /** null: the bead leaves the tray (it is confiscated). */
  to: { x: number; z: number } | null
}

export interface TrayTransition {
  moves: TrayMove[]
  radiusBefore: number
  radiusAfter: number
}

/**
 * Maps every bead of the tray before learn() to the tray after it, by colour group: the first
 * min(before, after) beads of a colour stay (and slide if the packing moved them), extra
 * beads in the after layout drop in, extra beads in the before layout leave. The beads that
 * leave are the last of their group, so the groups after it close up by one slot.
 */
export function trayTransition(
  before: readonly (number | null)[],
  after: readonly (number | null)[],
  cap = TRAY_CAP,
): TrayTransition {
  const lb = trayLayout(before, cap)
  const la = trayLayout(after, cap)
  const group = (beads: readonly TrayBead[], square: number) => beads.filter((b) => b.square === square)
  const moves: TrayMove[] = []
  for (let square = 0; square < Math.max(before.length, after.length); square++) {
    const was = group(lb.beads, square)
    const now = group(la.beads, square)
    const n = Math.max(was.length, now.length)
    for (let k = 0; k < n; k++) {
      moves.push({
        square,
        from: k < was.length ? { x: was[k].x, z: was[k].z } : null,
        to: k < now.length ? { x: now[k].x, z: now[k].z } : null,
      })
    }
  }
  return { moves, radiusBefore: lb.radius, radiusAfter: la.radius }
}

/**
 * Whole-number percentages of `counts` that always add up to exactly 100 (largest-remainder
 * rounding: floor every share, then hand the leftover points to the largest fractional parts,
 * the lower index first on a tie). An all-zero list gives all zeros.
 */
export function percentShares(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, c) => sum + c, 0)
  if (total <= 0) return counts.map(() => 0)
  const exact = counts.map((c) => (c * 100) / total)
  const floors = exact.map(Math.floor)
  let left = 100 - floors.reduce((sum, f) => sum + f, 0)
  const order = exact
    .map((x, i) => ({ i, rem: x - Math.floor(x) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] += 1
    left -= 1
  }
  return floors
}

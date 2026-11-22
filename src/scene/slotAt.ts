import { BOX, GRID_1961, type Grid } from './geometry'

/**
 * The slot nearest a point on the cabinet front (cabinet-local x, y). Picking goes by nearest
 * slot instead of by the box that was hit, so the gaps between boxes and a thumb that lands a
 * little off still choose a box. `count` is the number of slots in the grid; the last row may be partly empty.
 */
export function slotAt(x: number, y: number, count: number, g: Grid = GRID_1961): number {
  const col = Math.min(g.cols - 1, Math.max(0, Math.round(x / (BOX.w + BOX.gap) + (g.cols - 1) / 2)))
  const fromBottom = Math.round((y - BOX.gap - BOX.h / 2) / (BOX.h + BOX.gap))
  const row = Math.min(g.rows - 1, Math.max(0, g.rows - 1 - fromBottom))
  return Math.min(count - 1, row * g.cols + col)
}

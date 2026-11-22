// Two compositions of the same study. Wide (desktop): board front-left, box presented to the
// right. Tall (phone portrait): cabinet on top, box presented in the middle, board at the bottom.
import { useThree } from '@react-three/fiber'
import type { BoardPlacement, Placement, V3 } from './geometry'

export interface Layout {
  tall: boolean
  board: BoardPlacement
  present: Placement
  /** The dish of confiscated beads, on the desk where this camera can see it. */
  dish: V3
  camera: { fov: number; position: V3; look: V3 }
}

export const WIDE: Layout = {
  tall: false,
  board: { position: [-0.42, 0.004, -0.02], rotation: [0, 0.06, 0], cell: 0.27 },
  present: { position: [0.5, 0.55, -0.35], rotation: [0.72, -0.3, 0], scale: 0.6 },
  dish: [-0.98, 0, -0.62],
  camera: { fov: 42, position: [0.05, 1.42, 2.2], look: [0.05, 0.26, -0.7] },
}

export const TALL: Layout = {
  tall: true,
  board: { position: [0.5, 0.004, 0.22], rotation: [0, 0, 0], cell: 0.27 },
  present: { position: [0.52, 0.78, -0.62], rotation: [0.85, 0, 0], scale: 0.62 },
  dish: [1.12, 0, -0.5],
  camera: { fov: 64, position: [0.5, 2.6, 1.8], look: [0.5, 0.15, -0.5] },
}

export function useLayout(): Layout {
  const tall = useThree((s) => s.size.width < s.size.height)
  return tall ? TALL : WIDE
}

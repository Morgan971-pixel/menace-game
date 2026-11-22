// Shared pieces of the presented matchbox: wall thickness, the bead geometry and materials, the
// pose between slot and presented spot, and the tray/flap opening. Kept apart from MatchBox.tsx
// so that file exports only a component (fast refresh).
import { useMemo } from 'react'
import { Group, Matrix4, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three'
import { BEAD_COLORS, BOX, cabinetAt, gridFor, slotLocal, toMatrix, type Placement } from './geometry'
import { useGame } from '../state/store'

/** Wall thickness of the box, in box units. */
export const T = 0.022
export const TRAY_TRAVEL = 0.68
/** How far the drawer front folds down when the tray is fully open (radians). */
const FLAP_OPEN = Math.PI * 0.55

/** Unit sphere, scaled per bead to the layout's radius. */
export const beadGeometry = new SphereGeometry(1, 18, 14)
export const beadMaterials = BEAD_COLORS.map(
  (c) => new MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.05, emissive: c, emissiveIntensity: 0.18 }),
)

/** Tray-local y of a bead's centre resting on the tray floor. */
export const floorY = (radius: number) => -BOX.h / 2 + T * 2 + radius

export interface BoxPose {
  sp: Vector3
  sq: Quaternion
  ss: Vector3
  ep: Vector3
  eq: Quaternion
  es: Vector3
}

/** Start pose (in its cabinet slot) and end pose (presented) of a box. */
export function useBoxPose(slot: number, present: Placement): BoxPose {
  const rules = useGame((s) => s.brain.config.rules)
  return useMemo(() => {
    const start = toMatrix(cabinetAt(rules)).multiply(new Matrix4().makeTranslation(slotLocal(slot, gridFor(rules))))
    const r = { sp: new Vector3(), sq: new Quaternion(), ss: new Vector3(), ep: new Vector3(), eq: new Quaternion(), es: new Vector3() }
    start.decompose(r.sp, r.sq, r.ss)
    toMatrix(present).decompose(r.ep, r.eq, r.es)
    return r
  }, [slot, present, rules])
}

/** Places the box between its slot (k = 0) and the presented spot (k = 1), with a small lift. */
export function placeBox(g: Group, pose: BoxPose, k: number) {
  g.position.lerpVectors(pose.sp, pose.ep, k)
  g.quaternion.slerpQuaternions(pose.sq, pose.eq, k)
  g.scale.lerpVectors(pose.ss, pose.es, k)
  // a small lift on the way out so it clears the boxes below
  g.position.y += Math.sin(Math.PI * k) * 0.06
}

/** open: 0 = tray shut in the sleeve, 1 = fully out with the front folded down. */
export function setOpen(tray: Group, flap: Group, open: number) {
  tray.position.z = open * TRAY_TRAVEL
  flap.rotation.x = open * FLAP_OPEN
}

// The matchbox both presented boxes are built from: the MENACE turn (ActiveBox) and the
// post-game ledger (LedgerBox). Sleeve with the numbered label, a tray that slides out, and a
// drawer front hinged at the tray floor that folds down as the tray opens, so no bead in the
// tray is ever hidden behind it.
import { useEffect, useMemo, type ReactNode, type RefObject } from 'react'
import type { Group } from 'three'
import { BOX, makeLabelTexture, PALETTE } from './geometry'
import { T } from './boxParts'

interface Props {
  slot: number
  group: RefObject<Group | null>
  tray: RefObject<Group | null>
  flap: RefObject<Group | null>
  /** Drawn inside the tray (tray-local coordinates). */
  children?: ReactNode
}

export function MatchBox({ slot, group, tray, flap, children }: Props) {
  const label = useMemo(() => makeLabelTexture(`No. ${slot + 1}`), [slot])
  useEffect(() => () => label.dispose(), [label])
  const { w, h, d } = BOX
  const wallH = h * 0.62
  const floorTop = -h / 2 + T * 2

  return (
    <group ref={group}>
      {/* sleeve: four slabs, open at both ends; the top carries the label, like a real matchbox */}
      <mesh position={[0, h / 2 - T / 2, 0]}>
        <boxGeometry args={[w, T, d]} />
        <meshStandardMaterial attach="material-0" color={PALETTE.boxSide} roughness={0.8} />
        <meshStandardMaterial attach="material-1" color={PALETTE.boxSide} roughness={0.8} />
        <meshStandardMaterial attach="material-2" map={label} roughness={0.8} />
        <meshStandardMaterial attach="material-3" color={PALETTE.boxSide} roughness={0.8} />
        <meshStandardMaterial attach="material-4" color={PALETTE.boxSide} roughness={0.8} />
        <meshStandardMaterial attach="material-5" color={PALETTE.boxSide} roughness={0.8} />
      </mesh>
      <mesh position={[0, -h / 2 + T / 2, 0]}><boxGeometry args={[w, T, d]} /><meshStandardMaterial color={PALETTE.boxSide} roughness={0.8} /></mesh>
      <mesh position={[-w / 2 + T / 2, 0, 0]}><boxGeometry args={[T, h, d]} /><meshStandardMaterial color={PALETTE.boxSide} roughness={0.8} /></mesh>
      <mesh position={[w / 2 - T / 2, 0, 0]}><boxGeometry args={[T, h, d]} /><meshStandardMaterial color={PALETTE.boxSide} roughness={0.8} /></mesh>
      <group ref={tray}>
        <mesh position={[0, -h / 2 + T * 1.5, 0]}><boxGeometry args={[w - 2 * T - 0.01, T, d - 0.01]} /><meshStandardMaterial color={PALETTE.tray} roughness={0.9} /></mesh>
        <mesh position={[-(w / 2 - 1.5 * T), -h / 2 + T + wallH / 2, 0]}><boxGeometry args={[T, wallH, d - 0.01]} /><meshStandardMaterial color={PALETTE.tray} roughness={0.9} /></mesh>
        <mesh position={[w / 2 - 1.5 * T, -h / 2 + T + wallH / 2, 0]}><boxGeometry args={[T, wallH, d - 0.01]} /><meshStandardMaterial color={PALETTE.tray} roughness={0.9} /></mesh>
        <mesh position={[0, -h / 2 + T + wallH / 2, -d / 2 + T / 2]}><boxGeometry args={[w - 2 * T, wallH, T]} /><meshStandardMaterial color={PALETTE.tray} roughness={0.9} /></mesh>
        {/* drawer front, hinged on its outer bottom edge: upright when shut, folded down when open */}
        <group ref={flap} position={[0, floorTop - T, d / 2]}>
          <mesh position={[0, wallH / 2, -T / 2]}>
            <boxGeometry args={[w - 2 * T, wallH, T]} />
            <meshStandardMaterial color={PALETTE.tray} roughness={0.9} />
          </mesh>
        </group>
        {children}
      </group>
    </group>
  )
}

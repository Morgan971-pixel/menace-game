// PROTOTYPE: one MENACE turn. The box flies out of the cabinet, the tray opens,
// it shakes, a bead arcs to the chosen square, then everything goes back.
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Group, Matrix4, Mesh, Quaternion, Vector3 } from 'three'
import type { Turn } from './fakeGame'
import {
  BEAD_COLORS, BEAD_R, BOX, beadSpot, clamp01, ease, easeOutBack, makeLabelTexture,
  slotLocal, squareWorld, toMatrix, type BoardPlacement, type Placement,
} from './geometry'

export interface BoxLook {
  sleeve: string
  tray: string
  face: string
  ink: string
  accent: string
  bouncy?: boolean
}

const T = 0.022 // wall thickness
const TL = {
  out: [0, 0.8], open: [0.8, 1.2], shake: [1.2, 1.9], bead: [1.9, 2.8],
  close: [3.0, 3.4], back: [3.4, 4.1],
} as const
const prog = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a))

export function MenaceTurn({ turn, cabinet, present, board, look, onPlace }: {
  turn: Turn
  cabinet: Placement
  present: Placement
  board: BoardPlacement
  look: BoxLook
  onPlace: () => void
}) {
  const group = useRef<Group>(null)
  const tray = useRef<Group>(null)
  const chosen = useRef<Mesh>(null)
  const flyer = useRef<Mesh>(null)
  const t0 = useRef<number | null>(null)
  const flight = useRef<{ from: Vector3; r0: number } | null>(null)
  const placed = useRef(false)

  const { sp, sq, ss, ep, eq, es, target } = useMemo(() => {
    const start = toMatrix(cabinet).multiply(new Matrix4().makeTranslation(slotLocal(turn.box)))
    const end = toMatrix(present)
    const r = { sp: new Vector3(), sq: new Quaternion(), ss: new Vector3(), ep: new Vector3(), eq: new Quaternion(), es: new Vector3() }
    start.decompose(r.sp, r.sq, r.ss)
    end.decompose(r.ep, r.eq, r.es)
    return { ...r, target: squareWorld(turn.square, board) }
  }, [turn, cabinet, present, board])

  const chosenIndex = useMemo(() => turn.beads.indexOf(turn.square), [turn])
  const label = useMemo(
    () => makeLabelTexture({ bg: look.face, ink: look.ink, accent: look.accent, title: 'MENACE', sub: `No. ${turn.box + 1}` }),
    [look, turn.box],
  )

  useFrame(({ clock }) => {
    const g = group.current
    const tr = tray.current
    const fl = flyer.current
    if (!g || !tr || !fl) return
    if (t0.current === null) t0.current = clock.elapsedTime
    const t = clock.elapsedTime - t0.current

    const outK = (look.bouncy ? easeOutBack : ease)(prog(t, TL.out))
    const k = t < TL.back[0] ? outK : 1 - ease(prog(t, TL.back))
    g.position.lerpVectors(sp, ep, k)
    g.quaternion.slerpQuaternions(sq, eq, k)
    g.scale.lerpVectors(ss, es, k)
    g.visible = t < TL.back[1]

    if (t > TL.shake[0] && t < TL.shake[1]) {
      const s = prog(t, TL.shake)
      const a = Math.sin(s * Math.PI * 14) * 0.05 * (1 - s)
      g.rotateZ(a)
      g.rotateX(a * 0.5)
    }

    const open = t < TL.close[0] ? ease(prog(t, TL.open)) : 1 - ease(prog(t, TL.close))
    tr.position.z = open * 0.55

    if (t >= TL.bead[0] && t < TL.bead[1]) {
      if (!flight.current) {
        g.updateMatrixWorld(true)
        const from = new Vector3(...beadSpot(chosenIndex)).setY(BEAD_R - BOX.h / 2 + T * 2).applyMatrix4(tr.matrixWorld)
        flight.current = { from, r0: BEAD_R * es.x }
        if (chosen.current) chosen.current.visible = false
      }
      const e = ease(prog(t, TL.bead))
      const { from, r0 } = flight.current
      const rEnd = board.cell * 0.11
      fl.visible = true
      fl.position.lerpVectors(from, target, e)
      fl.position.y += Math.sin(Math.PI * e) * Math.max(0.35, from.distanceTo(target) * 0.4) + rEnd * e
      fl.scale.setScalar((r0 + (rEnd - r0) * e) / BEAD_R)
    } else fl.visible = false

    if (t >= TL.bead[1] && !placed.current) {
      placed.current = true
      onPlace()
    }
  })

  const { w, h, d } = BOX
  const wallH = h * 0.62
  return (
    <>
      <group ref={group}>
        {/* sleeve: four slabs, open at both ends */}
        <mesh position={[0, h / 2 - T / 2, 0]} castShadow><boxGeometry args={[w, T, d]} /><meshStandardMaterial color={look.sleeve} roughness={0.8} /></mesh>
        <mesh position={[0, -h / 2 + T / 2, 0]} castShadow><boxGeometry args={[w, T, d]} /><meshStandardMaterial color={look.sleeve} roughness={0.8} /></mesh>
        <mesh position={[-w / 2 + T / 2, 0, 0]} castShadow><boxGeometry args={[T, h, d]} /><meshStandardMaterial color={look.sleeve} roughness={0.8} /></mesh>
        <mesh position={[w / 2 - T / 2, 0, 0]} castShadow><boxGeometry args={[T, h, d]} /><meshStandardMaterial color={look.sleeve} roughness={0.8} /></mesh>
        {/* tray */}
        <group ref={tray}>
          <mesh position={[0, -h / 2 + T * 1.5, 0]}><boxGeometry args={[w - 2 * T - 0.01, T, d - 0.01]} /><meshStandardMaterial color={look.tray} roughness={0.9} /></mesh>
          <mesh position={[-(w / 2 - 1.5 * T), -h / 2 + T + wallH / 2, 0]}><boxGeometry args={[T, wallH, d - 0.01]} /><meshStandardMaterial color={look.tray} roughness={0.9} /></mesh>
          <mesh position={[w / 2 - 1.5 * T, -h / 2 + T + wallH / 2, 0]}><boxGeometry args={[T, wallH, d - 0.01]} /><meshStandardMaterial color={look.tray} roughness={0.9} /></mesh>
          <mesh position={[0, -h / 2 + T + wallH / 2, -d / 2 + T / 2]}><boxGeometry args={[w - 2 * T, wallH, T]} /><meshStandardMaterial color={look.tray} roughness={0.9} /></mesh>
          {/* labelled drawer front */}
          <mesh position={[0, 0, d / 2 - T / 2]} castShadow>
            <boxGeometry args={[w, h, T]} />
            <meshStandardMaterial attach="material-0" color={look.tray} />
            <meshStandardMaterial attach="material-1" color={look.tray} />
            <meshStandardMaterial attach="material-2" color={look.tray} />
            <meshStandardMaterial attach="material-3" color={look.tray} />
            <meshStandardMaterial attach="material-4" map={label} roughness={0.8} />
            <meshStandardMaterial attach="material-5" color={look.tray} />
          </mesh>
          {turn.beads.map((sq, k) => {
            const [x, , z] = beadSpot(k)
            return (
              <mesh key={k} ref={k === chosenIndex ? chosen : undefined} position={[x, -h / 2 + T * 2 + BEAD_R, z]} castShadow>
                <sphereGeometry args={[BEAD_R, 16, 12]} />
                <meshStandardMaterial color={BEAD_COLORS[sq]} roughness={0.25} metalness={0.05} />
              </mesh>
            )
          })}
        </group>
      </group>
      <mesh ref={flyer} visible={false} castShadow>
        <sphereGeometry args={[BEAD_R, 20, 14]} />
        <meshStandardMaterial color={BEAD_COLORS[turn.square]} roughness={0.25} emissive={BEAD_COLORS[turn.square]} emissiveIntensity={0.25} />
      </mesh>
    </>
  )
}

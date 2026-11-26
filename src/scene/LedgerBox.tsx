// One ledger item, physically: the box comes out to the presented spot with its tray open, the
// beads change (win: three drop in from above, draw: one drops in, loss: the drawn bead lifts out
// and goes to the dish on the desk), then the box goes home and the next one comes out.
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Group, Mesh, Vector3 } from 'three'
import { inspector } from '../state/inspector'
import { game, type LedgerItem } from '../state/store'
import { clamp01, DISH, dishSpot, ease, type Placement, type V3 } from './geometry'
import { beadGeometry, beadMaterials, floorY as restY, placeBox, setOpen, useBoxPose } from './boxParts'
import { MatchBox } from './MatchBox'
import { LEDGER_TIMELINE as TL } from './timing'
import { motionRate } from './motion'
import { trayTransition } from './trayLayout'

const prog = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a))
const A = TL.act
/** How far above the tray floor a dropped bead starts, in box units. */
const DROP_FROM = 0.8
const DROP_S = 0.3
const DROP_STAGGER = 0.09

interface Props {
  /** Index of this item in the ledger; reported back through ledgerNext. */
  index: number
  item: LedgerItem
  present: Placement
  /** World position of the dish. */
  dish: V3
  /** Which dish spot this item's confiscated bead takes. */
  dishIndex: number
}

export function LedgerBox({ index, item, present, dish, dishIndex }: Props) {
  const group = useRef<Group>(null)
  const tray = useRef<Group>(null)
  const flap = useRef<Group>(null)
  const beadRefs = useRef<(Mesh | null)[]>([])
  const flyer = useRef<Mesh>(null)
  const clock = useRef(0)
  const flight = useRef<{ from: Vector3; r0: number } | null>(null)
  const done = useRef(false)

  const pose = useBoxPose(item.slot, present)
  const tr = useMemo(() => trayTransition(item.before, item.after), [item])
  const loss = item.delta < 0
  // The bead that goes to the dish: the first move that leaves the tray.
  const leaving = useMemo(() => tr.moves.findIndex((m) => m.to === null), [tr])
  const target = useMemo(() => new Vector3(...dish).add(dishSpot(dishIndex)), [dish, dishIndex])
  const floorY = restY(tr.radiusBefore)

  // Position of the n-th entering bead among the entering ones, for the drop stagger.
  const dropOrder = useMemo(
    () => tr.moves.map((m, i) => (m.from === null && m.to !== null ? tr.moves.slice(0, i).filter((o) => o.from === null && o.to !== null).length : -1)),
    [tr],
  )

  useFrame((_, delta) => {
    const g = group.current
    const tray_ = tray.current
    const fp = flap.current
    const fl = flyer.current
    if (!g || !tray_ || !fp || !fl) return
    // The inspector is open: the ledger waits exactly here.
    if (inspector.getState().slot !== null) return
    // game time: real time x speed; a long frame (tab in the background) is clamped
    clock.current += Math.min(delta, 0.25) * game.getState().speed * motionRate()
    const t = clock.current
    const { es } = pose

    const k = t < TL.back[0] ? ease(prog(t, TL.out)) : 1 - ease(prog(t, TL.back))
    placeBox(g, pose, k)
    const open = t < TL.close[0] ? ease(prog(t, TL.open)) : 1 - ease(prog(t, TL.close))
    setOpen(tray_, fp, open)

    const slide = loss ? ease(prog(t, [A + 0.35, A + 0.55])) : ease(prog(t, [A, A + 0.2]))
    const rNow = tr.radiusBefore + (tr.radiusAfter - tr.radiusBefore) * slide
    tr.moves.forEach((m, i) => {
      const mesh = beadRefs.current[i]
      if (!mesh) return
      if (m.from !== null && m.to !== null) {
        mesh.visible = true
        mesh.position.set(m.from.x + (m.to.x - m.from.x) * slide, floorY, m.from.z + (m.to.z - m.from.z) * slide)
        mesh.scale.setScalar(rNow)
      } else if (m.from === null && m.to !== null) {
        const start = A + 0.1 + dropOrder[i] * DROP_STAGGER
        const p = clamp01((t - start) / DROP_S)
        mesh.visible = t >= start
        // fall with gravity (p squared), landing on the floor
        const y = floorY + DROP_FROM * (1 - p * p)
        mesh.position.set(m.to.x, y, m.to.z)
        mesh.scale.setScalar(tr.radiusAfter)
      } else {
        // leaving: hidden once the flyer takes over
        mesh.visible = !(i === leaving && t >= A)
      }
    })

    if (loss && leaving >= 0 && t >= A) {
      if (!flight.current) {
        g.updateMatrixWorld(true)
        const m = tr.moves[leaving]
        const from = new Vector3(m.from?.x ?? 0, floorY, m.from?.z ?? 0).applyMatrix4(tray_.matrixWorld)
        flight.current = { from, r0: tr.radiusBefore * es.x }
      }
      const e = ease(prog(t, [A, A + 0.55]))
      const { from, r0 } = flight.current
      fl.visible = true
      fl.position.lerpVectors(from, target, e)
      fl.position.y += Math.sin(Math.PI * e) * Math.max(0.25, from.distanceTo(target) * 0.3)
      fl.scale.setScalar(r0 + (DISH.bead - r0) * e)
    } else fl.visible = false
    // After landing, a loss's bead rests in the dish's spot until the next item replaces it with the dish's own.

    g.visible = t < TL.back[1]
    if (t >= TL.back[1] && !done.current) {
      done.current = true
      game.getState().ledgerNext(index)
    }
  })

  return (
    <>
      <MatchBox slot={item.slot} group={group} tray={tray} flap={flap}>
        {tr.moves.map((m, i) => (
          <mesh
            key={i}
            ref={(mesh) => { beadRefs.current[i] = mesh }}
            geometry={beadGeometry}
            material={beadMaterials[m.square]}
            position={[(m.from ?? m.to)?.x ?? 0, floorY, (m.from ?? m.to)?.z ?? 0]}
            scale={tr.radiusBefore}
            visible={m.from !== null}
          />
        ))}
      </MatchBox>
      <mesh ref={flyer} visible={false} geometry={beadGeometry} material={beadMaterials[item.square ?? 0]} castShadow />
    </>
  )
}

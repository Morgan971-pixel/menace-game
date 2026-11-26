// One MENACE turn, physically: the box flies out of its slot, the tray opens on its real
// beads, it shakes, the drawn bead arcs to its square (the X lands), then the box goes home.
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Group, Mesh, Vector3 } from 'three'
import { game, type MenaceTurn } from '../state/store'
import { BEAD_COLORS, BOX, clamp01, ease, markWorld, type BoardPlacement, type Placement } from './geometry'
import { beadGeometry, beadMaterials, floorY as restY, placeBox, setOpen, useBoxPose } from './boxParts'
import { MatchBox } from './MatchBox'
import { TURN_TIMELINE as TL } from './timing'
import { motionRate, reducedMotion } from './motion'
import { drawnIndex, trayLayout } from './trayLayout'

const prog = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a))

export function ActiveBox({ turn, present, board }: { turn: MenaceTurn; present: Placement; board: BoardPlacement }) {
  const group = useRef<Group>(null)
  const tray = useRef<Group>(null)
  const flap = useRef<Group>(null)
  const beadRefs = useRef<(Mesh | null)[]>([])
  const flyer = useRef<Mesh>(null)
  /** The turn's own time: each frame adds at most 0.1 s, so a slow frame slows the animation instead of skipping it. */
  const clock = useRef(0)
  const flight = useRef<{ from: Vector3; r0: number } | null>(null)
  const landed = useRef(false)
  const home = useRef(false)
  const rattled = useRef(false)

  const pose = useBoxPose(turn.slot, present)
  const target = useMemo(() => markWorld(turn.square, board), [turn.square, board])
  const layout = useMemo(() => trayLayout(turn.beads), [turn.beads])
  const chosen = useMemo(() => drawnIndex(layout.beads, turn.square), [layout, turn.square])
  const tagBox = useRef<HTMLDivElement>(null)

  const { h, d } = BOX
  const r = layout.radius
  const floorY = restY(r)

  useFrame((_, delta) => {
    const g = group.current
    const tr = tray.current
    const fp = flap.current
    const fl = flyer.current
    if (!g || !tr || !fp || !fl) return
    clock.current += Math.min(delta, 0.1) * motionRate()
    const t = clock.current
    const { es } = pose

    const k = t < TL.back[0] ? ease(prog(t, TL.out)) : 1 - ease(prog(t, TL.back))
    placeBox(g, pose, k)
    g.visible = t < TL.back[1]
    const shaking = t > TL.shake[0] && t < TL.shake[1]
    if (shaking) {
      const s = prog(t, TL.shake)
      const a = reducedMotion() ? 0 : Math.sin(s * Math.PI * 14) * 0.05 * (1 - s)
      g.rotateZ(a)
      g.rotateX(a * 0.5)
    }
    // Beads rattle only while shaking; once the shake ends they go back to rest, once.
    if (shaking || rattled.current) {
      const j = shaking ? (1 - prog(t, TL.shake)) * r * 0.3 : 0
      beadRefs.current.forEach((m, i) => {
        if (!m) return
        const b = layout.beads[i]
        m.position.set(b.x + Math.sin(t * 61 + i * 2.1) * j, floorY + Math.abs(Math.sin(t * 47 + i)) * j, b.z + Math.cos(t * 53 + i * 1.3) * j)
      })
      rattled.current = shaking
    }

    const open = t < TL.close[0] ? ease(prog(t, TL.open)) : 1 - ease(prog(t, TL.close))
    setOpen(tr, fp, open)
    // Number tags (square and true count per colour) show while the tray is open.
    if (tagBox.current) tagBox.current.style.opacity = open > 0.95 && t < TL.close[0] ? '1' : '0'

    if (t >= TL.bead[0] && t < TL.bead[1] && chosen >= 0) {
      if (!flight.current) {
        g.updateMatrixWorld(true)
        const b = layout.beads[chosen]
        const from = new Vector3(b.x, floorY, b.z).applyMatrix4(tr.matrixWorld)
        flight.current = { from, r0: r * es.x }
        const m = beadRefs.current[chosen]
        if (m) m.visible = false
      }
      const e = ease(prog(t, TL.bead))
      const { from, r0 } = flight.current
      const rEnd = board.cell * 0.1
      fl.visible = true
      fl.position.lerpVectors(from, target, e)
      fl.position.y += Math.sin(Math.PI * e) * Math.max(0.3, from.distanceTo(target) * 0.35) + rEnd * e
      fl.scale.setScalar(r0 + (rEnd - r0) * e)
    } else fl.visible = false

    if (t >= TL.bead[1] && !landed.current) {
      landed.current = true
      game.getState().land()
    }
    if (t >= TL.back[1] && !home.current) {
      home.current = true
      game.getState().boxHome()
    }
  })

  return (
    <>
      <MatchBox slot={turn.slot} group={group} tray={tray} flap={flap}>
        {layout.beads.map((b, i) => (
          <mesh
            key={i}
            ref={(m) => { beadRefs.current[i] = m }}
            geometry={beadGeometry}
            material={beadMaterials[b.square]}
            position={[b.x, floorY, b.z]}
            scale={r}
          />
        ))}
        {layout.tags.length > 0 && (
          <Html position={[0, -h / 2, d / 2 + 0.02]} zIndexRange={[15, 0]} pointerEvents="none">
            <div ref={tagBox} className="bead-tags" style={{ opacity: 0 }} aria-hidden="true">
              {layout.tags.map((tag) => (
                <span key={tag.square} className="bead-tag" style={{ borderColor: BEAD_COLORS[tag.square] }}>
                  <i style={{ background: BEAD_COLORS[tag.square] }} />
                  <b>{tag.square + 1}</b>×{tag.count}
                </span>
              ))}
            </div>
          </Html>
        )}
      </MatchBox>
      <mesh ref={flyer} visible={false} geometry={beadGeometry} castShadow>
        <meshStandardMaterial
          color={BEAD_COLORS[turn.square]}
          roughness={0.25}
          emissive={BEAD_COLORS[turn.square]}
          emissiveIntensity={0.25}
        />
      </mesh>
    </>
  )
}

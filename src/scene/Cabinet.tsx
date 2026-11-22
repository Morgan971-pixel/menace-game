// The cabinet: one InstancedMesh, slot i = slotOfKey (engine/slots.ts). 1961 rules fill a 16 x 19
// grid (304 boxes); the engine rules use 18 x 19 (338 possible boxes, shown as they are made).
// A slot with no box yet, or whose box is out on the desk, is left empty so you can see the home.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three'
import { slotMade, slotCount } from '../engine/slots'
import { useBlocked } from '../state/blockers'
import { canPick, inspector, useInspector } from '../state/inspector'
import { game, useGame } from '../state/store'
import { BOX, cabinetAt, cabinetSize, euler, gridFor, makeLabelTexture, MAX_SLOTS, PALETTE, slotLocal } from './geometry'
import { slotAt } from './slotAt'

const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const pointLocal = new Vector3() // reused by every pointer move
const baseTint = (i: number) => 0.82 + 0.18 * hash(i)

/** How far the selected box slides out of its slot, and how much it grows, in box units. */
const SELECT_OUT = 0.3
const SELECT_GROW = 1.08


export function Cabinet() {
  const ref = useRef<InstancedMesh>(null)
  const empty = useGame((s) => (s.boxOut && s.turn && !s.turn.forced ? s.turn.slot : null))
  const brain = useGame((s) => s.brain)
  const rules = brain.config.rules
  const grid = gridFor(rules)
  const size = cabinetSize(grid)
  const at = cabinetAt(rules)
  const slots = slotCount(rules)
  // Engine boxes are made as play goes. The count is read so the cabinet redraws when one appears;
  // learn() and chooseMove mutate the brain in place, so its reference alone does not change.
  const made = useGame((s) => s.brain.boxes.size)
  const selected = useInspector((s) => s.slot)
  const hover = useInspector((s) => s.hover)
  // Between games only (and the ledger through its own button): a stray click can never touch play.
  // A panel open over the cabinet (Train, Curve, How, Machine) switches picking off too.
  const blocked = useBlocked()
  const pickable = useGame((s) => canPick(s.phase, s.training !== null, blocked))
  const hot = pickable && hover !== null ? hover : null

  // Engine rules: a pale recess behind every slot, so a box that is not made yet still has a visible home.
  const homes = useRef<InstancedMesh>(null)
  const homeGeometry = useMemo(() => new BoxGeometry(BOX.w, BOX.h, 0.05), [])
  useLayoutEffect(() => {
    const mesh = homes.current
    if (!mesh) return
    const m = new Matrix4()
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (i < slots) {
        const at = slotLocal(i, grid)
        m.makeTranslation(at.x, at.y, 0.345)
      } else m.makeScale(0, 0, 0)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [grid, slots, rules])
  useEffect(() => () => homeGeometry.dispose(), [homeGeometry])

  const geometry = useMemo(() => new BoxGeometry(BOX.w, BOX.h, BOX.d), [])
  const material = useMemo(() => {
    const side = new MeshStandardMaterial({ color: PALETTE.boxSide, roughness: 0.85 })
    const label = new MeshStandardMaterial({ map: makeLabelTexture(), roughness: 0.8 })
    return [side, side, side, side, label, side]
  }, [])

  // Built by hand (not JSX), so free them on unmount.
  useEffect(
    () => () => {
      geometry.dispose()
      for (const m of new Set(material)) {
        m.map?.dispose()
        m.dispose()
      }
    },
    [geometry, material],
  )

  // Per-box tint, set once.
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new Color()
    for (let i = 0; i < MAX_SLOTS; i++) mesh.setColorAt(i, c.setScalar(baseTint(i)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  // Training shimmer: the boxes used in the latest chunk glow a soft cool white and pulse,
  // then return to their tint. No box leaves the cabinet.
  const lit = useRef<number[]>([])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const run = game.getState().training
    if (run === null && lit.current.length === 0) return
    const c = new Color()
    for (const i of lit.current) mesh.setColorAt(i, c.setScalar(baseTint(i)))
    lit.current = run === null ? [] : [...new Set(run.hot)].filter((i) => i >= 0)
    const k = 1.35 + 0.35 * Math.sin(clock.elapsedTime * 9)
    for (const i of lit.current) mesh.setColorAt(i, c.setRGB(baseTint(i) * k, baseTint(i) * k * 1.12, baseTint(i) * k * 1.12))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const grow = new Matrix4()
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (i === empty || i >= slots || !slotMade(brain, i)) m.makeScale(0, 0, 0)
      else if (i === selected) {
        // The inspected box slides forward and swells a little, so it reads as picked.
        const at = slotLocal(i, grid)
        m.makeTranslation(at.x, at.y, at.z + SELECT_OUT)
        m.multiply(grow.makeScale(SELECT_GROW, SELECT_GROW, SELECT_GROW))
      } else m.makeTranslation(slotLocal(i, grid))
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [empty, selected, brain, made, grid, slots])

  // Selected and hovered boxes glow a cool white; everything else keeps its tint.
  const painted = useRef<number[]>([])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new Color()
    for (const i of painted.current) mesh.setColorAt(i, c.setScalar(baseTint(i)))
    painted.current = []
    const glow = (i: number | null, k: number) => {
      if (i === null || i < 0 || i >= MAX_SLOTS) return
      mesh.setColorAt(i, c.setRGB(baseTint(i) * k, baseTint(i) * k * 1.1, baseTint(i) * k * 1.1))
      painted.current.push(i)
    }
    glow(hot, 1.5)
    glow(selected, 2.8)
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [hot, selected])

  // Leaving the pickable state (a game starts, training starts) forgets the hover.
  useEffect(() => {
    if (!pickable) inspector.getState().setHover(null)
  }, [pickable])

  // Pointer cursor over the pickable cabinet.
  useEffect(() => {
    document.body.style.cursor = hot !== null ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hot])

  const slotOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const p = e.object.worldToLocal(pointLocal.copy(e.point))
    const slot = slotAt(p.x, p.y + size.h / 2, slots, grid)
    // A slot whose box is not made yet (engine rules) picks nothing.
    return slotMade(game.getState().brain, slot) ? slot : null
  }

  return (
    <group position={at.position} rotation={euler(at)} scale={at.scale ?? 1}>
      <instancedMesh ref={ref} args={[geometry, material, MAX_SLOTS]} castShadow receiveShadow />
      {rules === 'engine' && (
        <instancedMesh ref={homes} args={[homeGeometry, undefined, MAX_SLOTS]} receiveShadow>
          <meshStandardMaterial color="#6a4a32" emissive="#3a2616" emissiveIntensity={0.6} roughness={0.9} />
        </instancedMesh>
      )}
      {/* invisible front: picks the nearest slot, gaps and all */}
      {pickable && (
        <mesh
          position={[0, size.h / 2, BOX.d / 2 + 0.02]}
          onPointerMove={(e) => {
            e.stopPropagation()
            inspector.getState().setHover(slotOf(e))
          }}
          onPointerOut={() => inspector.getState().setHover(null)}
          onClick={(e) => {
            e.stopPropagation()
            const slot = slotOf(e)
            if (slot !== null) inspector.getState().open(slot)
          }}
        >
          <planeGeometry args={[size.w, size.h]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {/* carcass: the back and dividers you see through an empty slot */}
      <mesh position={[0, size.h / 2, -0.12]} castShadow receiveShadow>
        <boxGeometry args={[size.w + 0.4, size.h + 0.3, BOX.d]} />
        <meshStandardMaterial color={PALETTE.frame} roughness={0.75} />
      </mesh>
      {/* top rail */}
      <mesh position={[0, size.h + 0.2, 0.02]} castShadow>
        <boxGeometry args={[size.w + 0.7, 0.18, BOX.d + 0.15]} />
        <meshStandardMaterial color="#4a2e1c" roughness={0.6} />
      </mesh>
    </group>
  )
}

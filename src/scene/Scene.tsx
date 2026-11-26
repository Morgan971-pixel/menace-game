// The study at night. Camera framing for wide (desktop) and tall (phone portrait) screens.
import { PerformanceMonitor, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Object3D, type Group, type PerspectiveCamera as Camera, type SpotLight } from 'three'
import { dishTotal } from '../state/dish'
import { useGame } from '../state/store'
import { Speech } from '../ui/Speech'
import { BoxTip } from '../ui/Tips'
import { ActiveBox } from './ActiveBox'
import { Board } from './Board'
import { Cabinet } from './Cabinet'
import { beadGeometry, beadMaterials } from './boxParts'
import { Desk } from './Desk'
import { Milestone } from './Milestone'
import { useDishBeads } from './dishBeads'
import { PALETTE, type Placement } from './geometry'
import { Lamp } from './Lamp'
import { LedgerBox } from './LedgerBox'
import { MatchBox } from './MatchBox'
import { useLayout, type Layout } from './layout'

function Rig({ f }: { f: Layout['camera'] }) {
  const cam = useRef<Camera>(null)
  useLayoutEffect(() => {
    cam.current?.lookAt(...f.look)
  }, [f])
  return <PerspectiveCamera ref={cam} makeDefault fov={f.fov} near={0.05} far={30} position={f.position} />
}

/** Cool moonlight on the cabinet, from up and to the right. */
function Moon() {
  const ref = useRef<SpotLight>(null)
  useLayoutEffect(() => {
    const light = ref.current
    if (!light) return
    light.target.position.set(0.6, 0.5, -1.8)
    light.target.updateMatrixWorld()
  }, [])
  return <spotLight ref={ref} position={[2.2, 2.6, 1.6]} angle={0.45} penumbra={1} intensity={10} color={PALETTE.moon} />
}

/** Narrow, shadowless fill on the presented box so its tray and label read. */
function BoxFill({ present }: { present: Placement }) {
  const aim = useMemo(() => {
    const o = new Object3D()
    o.position.set(...present.position)
    return o
  }, [present])
  const [x, y, z] = present.position
  return (
    <>
      <primitive object={aim} />
      <spotLight target={aim} position={[x + 0.3, y + 1.0, z + 0.9]} angle={0.22} penumbra={0.6} intensity={5.5} decay={0} color={PALETTE.lamp} />
    </>
  )
}

/**
 * Compiles the shaders a turn needs while the title is up, so the first turn does not
 * stall for a second or two. A matchbox, the nine bead materials and the presented box's
 * fill light (a light changes the shader of everything in the scene) sit far out of view for
 * one compile, then unmount. Shader programs stay cached.
 */
function Precompile() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const group = useRef<Group>(null)
  const tray = useRef<Group>(null)
  const flap = useRef<Group>(null)
  const [done, setDone] = useState(false)
  // On the first frame the box is in the scene; compile once, then drop it.
  useFrame(() => {
    if (done) return
    try {
      gl.compile(scene, camera)
    } catch {
      // A failed pre-compile only costs the first-turn hitch it was meant to remove.
    }
    setDone(true)
  })
  if (done) return null
  return (
    <group position={[0, -40, 0]}>
      <MatchBox slot={0} group={group} tray={tray} flap={flap}>
        {beadMaterials.map((m, i) => (
          <mesh key={i} geometry={beadGeometry} material={m} scale={0.01} />
        ))}
      </MatchBox>
      <spotLight position={[0, 1, 1]} angle={0.22} penumbra={0.6} intensity={0} decay={0} color={PALETTE.lamp} />
    </group>
  )
}

function World() {
  const layout = useLayout()
  const turn = useGame((s) => s.turn)
  const boxOut = useGame((s) => s.boxOut)
  const showBox = turn !== null && !turn.forced && boxOut
  const phase = useGame((s) => s.phase)
  const ledger = useGame((s) => s.ledger)
  const ledgerAt = useGame((s) => s.ledgerAt)
  const item = phase === 'ledger' && !boxOut && ledgerAt >= 0 ? ledger[ledgerAt] : undefined
  // Dish spot of this item's bead: the next free spot after every bead already in the dish.
  const dishIndex = dishTotal(useDishBeads())

  return (
    <>
      <Rig f={layout.camera} />
      <color attach="background" args={[PALETTE.night]} />
      <fog attach="fog" args={[PALETTE.night, 4, 9]} />
      <hemisphereLight args={['#4a7480', '#1a110a', 0.7]} />
      <Moon />
      <Lamp />
      <Desk dish={layout.dish} />
      <Cabinet />
      <Milestone />
      <Board />
      {(showBox || item) && <BoxFill present={layout.present} />}
      {showBox && <ActiveBox key={turn.id} turn={turn} present={layout.present} board={layout.board} />}
      {item && <LedgerBox key={ledgerAt} index={ledgerAt} item={item} present={layout.present} dish={layout.dish} dishIndex={dishIndex} />}
      <Precompile />
      <BoxTip present={layout.present} tall={layout.tall} />
      <Speech tall={layout.tall} />
    </>
  )
}

/** Few cores or little memory: start in low quality (pixel ratio 1, no shadows). */
function weakDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const n = navigator as Navigator & { deviceMemory?: number }
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4
}

export function Scene() {
  // Drops to low quality, once, if the frame rate falls; never climbs back mid-game.
  const [low, setLow] = useState(weakDevice)
  return (
    <Canvas
      shadows={low ? false : 'percentage'}
      dpr={low ? 1 : [1, 2]}
      className="scene"
      role="img"
      aria-label="Michie's study: the cabinet of matchboxes and the board"
      data-quality={low ? 'low' : 'high'}
    >
      <PerformanceMonitor onDecline={() => setLow(true)} />
      <World />
    </Canvas>
  )
}

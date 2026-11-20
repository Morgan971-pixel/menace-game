// PROTOTYPE variant C: toy diorama. Orthographic iso camera on a floating
// tabletop, chunky rounded shapes, bouncy motion, speech bubble in the world.
import { ContactShadows, Html, RoundedBox } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { OrthographicCamera } from 'three'
import { Board } from './shared/Board'
import { Cabinet, type CabinetLook } from './shared/Cabinet'
import { HOW_STEPS, RESULT_TITLE, useGame } from './shared/fakeGame'
import { CABINET, type BoardPlacement, type Placement } from './shared/geometry'
import { MenaceTurn, type BoxLook } from './shared/MenaceTurn'

export const nameC = 'Toy diorama'

const CAB: Placement = { position: [-1.15, 0, -1.15], rotation: [0, Math.PI / 4, 0], scale: 0.2 }
const PRESENT: Placement = { position: [-1.3, 1.45, 0.9], rotation: [0.75, Math.PI / 4, 0], scale: 1.6 }
const BOARD: BoardPlacement = { position: [0.95, 0, 0.95], rotation: [0, Math.PI / 4, 0], cell: 0.8 }

const cabLook: CabinetLook = {
  face: '#fff6e6', side: '#fff6e6', ink: '#2b3a3a', accent: '#c0443b', frame: '#2f7f7a', rounded: true,
  tints: ['#fff6e6', '#cfe9e1', '#f4d6d2', '#d6e4f5', '#f6ecc4'],
}
const boxLook: BoxLook = { sleeve: '#f4d6d2', tray: '#fff6e6', face: '#fff6e6', ink: '#2b3a3a', accent: '#c0443b', bouncy: true }

function Framing() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as OrthographicCamera
    cam.position.set(10, 9, 10)
    cam.zoom = Math.min(size.width, size.height * 1.15) / 6.4
    cam.lookAt(0, size.width < size.height ? 0.6 : 1.05, 0)
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function Tree({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.07, 0.09, 0.4, 10]} /><meshStandardMaterial color="#7a5a43" /></mesh>
      <mesh position={[0, 0.62, 0]} castShadow><coneGeometry args={[0.32, 0.7, 10]} /><meshStandardMaterial color="#3c9d7a" roughness={0.7} /></mesh>
    </group>
  )
}

function SceneC() {
  const turn = useGame((s) => s.turn)
  const phase = useGame((s) => s.phase)
  const line = useGame((s) => s.line)
  const placeMenace = useGame((s) => s.placeMenace)
  return (
    <>
      <Framing />
      <ambientLight intensity={0.9} color="#fff1e0" />
      <directionalLight position={[5, 9, 4]} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-0.0006} />
      <directionalLight position={[-6, 3, -2]} intensity={0.6} color="#bfe3ff" />

      {/* floating tabletop */}
      <RoundedBox args={[5.4, 0.5, 5.4]} radius={0.22} position={[0, -0.25, 0]} receiveShadow><meshStandardMaterial color="#f3ead8" roughness={0.8} /></RoundedBox>
      <RoundedBox args={[5.2, 0.6, 5.2]} radius={0.22} position={[0, -0.72, 0]}><meshStandardMaterial color="#2f7f7a" roughness={0.7} /></RoundedBox>
      <ContactShadows position={[0, 0.01, 0]} scale={7} blur={2.4} opacity={0.35} far={2} />

      <Cabinet placement={CAB} hidden={turn?.box ?? null} look={cabLook} />
      <Tree p={[2.05, 0, -1.9]} />
      <Tree p={[1.55, 0, -2.2]} s={0.7} />
      <Tree p={[-2.0, 0, 1.95]} s={0.85} />

      <Board
        placement={BOARD}
        look={{ x: '#c0443b', o: '#fffaf0', height: 0.16, lift: 0.18, chunky: true }}
        tile={(_, hovered) => (
          <RoundedBox args={[0.72, 0.2, 0.72]} radius={0.07} position={[0, hovered ? 0.14 : 0.1, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={hovered ? '#d9f0e8' : '#a9d8ca'} roughness={0.6} />
          </RoundedBox>
        )}
      />
      {turn && <MenaceTurn key={turn.id} turn={turn} cabinet={CAB} present={PRESENT} board={BOARD} look={boxLook} onPlace={placeMenace} />}

      {phase !== 'title' && (
        <Html position={[-1.15, CABINET.h * 0.2 + 0.45, -1.15]} center zIndexRange={[10, 0]}>
          <div className="c-bubble" key={line}>{line}</div>
        </Html>
      )}
    </>
  )
}

function OverlayC() {
  const { phase, score, result, showHow, start, setShowHow } = useGame()
  return (
    <div className="c-ui">
      {phase === 'title' && (
        <div className="c-title">
          <h1>MENACE</h1>
          <p>304 matchboxes. It learns from every mistake you let it make.</p>
          <div className="c-actions">
            <button className="c-btn c-btn--primary" onClick={start}>Play</button>
            <button className="c-btn" onClick={() => setShowHow(true)}>How it works</button>
          </div>
        </div>
      )}
      {phase !== 'title' && (
        <div className="c-score">
          <span className="c-chip c-chip--x">MENACE {score.menace}</span>
          <span className="c-chip">Draws {score.draws}</span>
          <span className="c-chip c-chip--o">You {score.you}</span>
        </div>
      )}
      {phase === 'over' && result && (
        <div className="c-over">
          <h2>{RESULT_TITLE[result]}!</h2>
          <button className="c-btn c-btn--primary" onClick={start}>Again!</button>
        </div>
      )}
      {showHow && (
        <div className="c-modal" onClick={() => setShowHow(false)}>
          <div className="c-card" onClick={(e) => e.stopPropagation()}>
            <h2>How it works</h2>
            <div className="c-steps">
              {HOW_STEPS.map((s, i) => (
                <div className="c-step" key={s.title}><div className="c-num">{i + 1}</div><h3>{s.title}</h3><p>{s.body}</p></div>
              ))}
            </div>
            <button className="c-btn c-btn--primary" onClick={() => setShowHow(false)}>Let's play</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function VariantC() {
  return (
    <div className="proto vC">
      <Canvas shadows orthographic dpr={[1, 2]} gl={{ alpha: true }} camera={{ near: 0.1, far: 100 }}>
        <SceneC />
      </Canvas>
      <OverlayC />
    </div>
  )
}

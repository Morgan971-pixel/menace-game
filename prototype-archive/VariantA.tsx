// PROTOTYPE variant A: Michie's study, 1961. Eye-level across a desk at night,
// cabinet against the wall, banker's lamp, board drawn on a sheet of paper.
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { PerspectiveCamera } from 'three'
import { Board } from './shared/Board'
import { Cabinet, type CabinetLook } from './shared/Cabinet'
import { HOW_STEPS, RESULT_TITLE, useGame } from './shared/fakeGame'
import { BEAD_COLORS, type BoardPlacement, type Placement } from './shared/geometry'
import { MenaceTurn, type BoxLook } from './shared/MenaceTurn'
import { Spot } from './shared/Spot'

export const nameA = "Michie's study, 1961"

const CAB: Placement = { position: [0.55, 0, -1.86], scale: 0.155 }
const PRESENT: Placement = { position: [0.5, 0.5, -0.45], rotation: [0.35, -0.3, 0], scale: 0.5 }
const BOARD: BoardPlacement = { position: [-0.5, 0.004, 0.12], rotation: [0, 0.07, 0], cell: 0.27 }

const cabLook: CabinetLook = { face: '#e9dfc7', side: '#c9b48e', ink: '#2a2420', accent: '#1d4e52', frame: '#3b2516' }
const boxLook: BoxLook = { sleeve: '#c9b48e', tray: '#e3d6b8', face: '#e9dfc7', ink: '#2a2420', accent: '#1d4e52' }

function Framing() {
  const { camera, size } = useThree()
  useEffect(() => {
    const portrait = size.width < size.height
    const cam = camera as PerspectiveCamera
    cam.fov = portrait ? 68 : 42
    if (portrait) cam.position.set(0.1, 2.6, 2.4)
    else cam.position.set(0, 1.3, 2.25)
    cam.lookAt(0.1, portrait ? 0.0 : 0.32, -0.55)
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function Lamp() {
  return (
    <group position={[1.75, 0, -1.0]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.02, 0]} castShadow><cylinderGeometry args={[0.16, 0.19, 0.04, 32]} /><meshStandardMaterial color="#b08d4a" metalness={0.8} roughness={0.3} /></mesh>
      <mesh position={[0, 0.38, 0]}><cylinderGeometry args={[0.018, 0.018, 0.72, 12]} /><meshStandardMaterial color="#b08d4a" metalness={0.8} roughness={0.3} /></mesh>
      <group position={[0.18, 0.74, 0.22]} rotation={[0.35, -0.6, 0]}>
        <mesh><cylinderGeometry args={[0.1, 0.24, 0.16, 32, 1, true]} /><meshStandardMaterial color="#1f6b4f" roughness={0.25} metalness={0.2} side={2} /></mesh>
        <mesh position={[0, -0.04, 0]}><sphereGeometry args={[0.05, 16, 12]} /><meshStandardMaterial color="#fff4d6" emissive="#ffd99a" emissiveIntensity={4} /></mesh>
      </group>
    </group>
  )
}

function SceneA() {
  const turn = useGame((s) => s.turn)
  const placeMenace = useGame((s) => s.placeMenace)
  return (
    <>
      <color attach="background" args={['#0b1517']} />
      <fog attach="fog" args={['#0b1517', 4, 9]} />
      <Framing />
      <hemisphereLight args={['#35606a', '#1a110a', 0.55]} />
      <pointLight position={[1.5, 0.72, -0.75]} color="#ffe6c2" intensity={4.5} decay={2} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
      <Spot position={[1.4, 0.85, -0.7]} target={[-0.3, 0, 0.1]} angle={0.9} penumbra={0.8} intensity={11} color="#ffe6c2" castShadow />
      <Spot position={[2.2, 2.6, 1.6]} target={[0.6, 0.5, -1.8]} angle={0.45} penumbra={1} intensity={10} color="#9cc7d0" />

      {/* wall + desk */}
      <mesh position={[0, 1.2, -2.0]} receiveShadow><planeGeometry args={[9, 4]} /><meshStandardMaterial color="#1d3b40" roughness={0.95} /></mesh>
      <mesh position={[0, -0.04, -0.5]} receiveShadow><boxGeometry args={[4.6, 0.08, 3.1]} /><meshStandardMaterial color="#3a2a1f" roughness={0.55} /></mesh>

      <Cabinet placement={CAB} hidden={turn?.box ?? null} look={cabLook} />
      <Lamp />

      {/* dish of confiscated beads */}
      <group position={[-1.5, 0, -0.35]}>
        <mesh position={[0, 0.025, 0]} castShadow receiveShadow><cylinderGeometry args={[0.2, 0.15, 0.05, 32]} /><meshStandardMaterial color="#e9e2d2" roughness={0.3} /></mesh>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <mesh key={k} position={[Math.cos(k * 1.7) * 0.09, 0.07, Math.sin(k * 1.7) * 0.09]} castShadow>
            <sphereGeometry args={[0.022, 12, 10]} /><meshStandardMaterial color={BEAD_COLORS[(k * 4) % 9]} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {/* pencil */}
      <mesh position={[0.25, 0.012, 0.42]} rotation={[0, 0.5, Math.PI / 2]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.42, 6]} /><meshStandardMaterial color="#2f6e5c" /></mesh>

      <Board
        placement={BOARD}
        look={{ x: '#a8322d', o: '#1f2a30', height: 0.004, lift: 0.002 }}
        base={
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.0, 1.08]} /><meshStandardMaterial color="#efe6d2" roughness={0.95} /></mesh>
            {[-0.5, 0.5].map((o) => (
              <group key={o}>
                <mesh position={[o * 0.27, 0.002, 0]}><boxGeometry args={[0.008, 0.002, 0.78]} /><meshStandardMaterial color="#2a2f33" /></mesh>
                <mesh position={[0, 0.002, o * 0.27]}><boxGeometry args={[0.78, 0.002, 0.008]} /><meshStandardMaterial color="#2a2f33" /></mesh>
              </group>
            ))}
          </>
        }
      />
      {turn && <MenaceTurn key={turn.id} turn={turn} cabinet={CAB} present={PRESENT} board={BOARD} look={boxLook} onPlace={placeMenace} />}
    </>
  )
}

function OverlayA() {
  const { phase, line, score, result, showHow, start, setShowHow } = useGame()
  return (
    <div className="a-ui">
      {phase === 'title' && (
        <div className="a-title">
          <p className="a-kicker">Edinburgh, 1961</p>
          <h1>MENACE</h1>
          <p className="a-tag">304 matchboxes. It learns from every mistake you let it make.</p>
          <div className="a-actions">
            <button className="a-btn a-btn--primary" onClick={start}>Play</button>
            <button className="a-btn" onClick={() => setShowHow(true)}>How it works</button>
          </div>
        </div>
      )}
      {phase !== 'title' && (
        <>
          <div className="a-slip" key={line}><span>MENACE:</span> {line}</div>
          <div className="a-score">
            <div><b>{score.menace}</b>MENACE</div>
            <div><b>{score.draws}</b>Drawn</div>
            <div><b>{score.you}</b>You</div>
          </div>
        </>
      )}
      {phase === 'over' && result && (
        <div className="a-over">
          <h2>{RESULT_TITLE[result]}</h2>
          <button className="a-btn a-btn--primary" onClick={start}>Play again</button>
        </div>
      )}
      {showHow && (
        <div className="a-modal" onClick={() => setShowHow(false)}>
          <div className="a-card" onClick={(e) => e.stopPropagation()}>
            <h2>How it works</h2>
            <ol>{HOW_STEPS.map((s) => <li key={s.title}><b>{s.title}.</b> {s.body}</li>)}</ol>
            <button className="a-btn a-btn--primary" onClick={() => setShowHow(false)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function VariantA() {
  return (
    <div className="proto vA">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 42, near: 0.05, far: 30 }}>
        <SceneA />
      </Canvas>
      <OverlayA />
    </div>
  )
}

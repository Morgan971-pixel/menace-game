// PROTOTYPE variant B: museum exhibit. Dark gallery, cabinet in a glass case on a
// plinth under spotlights, board on a lit lectern, UI as exhibit placards.
import { Edges } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Board } from './shared/Board'
import { Cabinet, type CabinetLook } from './shared/Cabinet'
import { HOW_STEPS, RESULT_TITLE, useGame } from './shared/fakeGame'
import { CABINET, type BoardPlacement, type Placement } from './shared/geometry'
import { MenaceTurn, type BoxLook } from './shared/MenaceTurn'
import { Spot } from './shared/Spot'

export const nameB = 'Museum exhibit'

const CAB: Placement = { position: [0, 1.0, -0.3], scale: 0.12 }
const PRESENT: Placement = { position: [0.6, 1.5, 0.45], rotation: [0.45, -0.35, 0], scale: 0.42 }
const BOARD: BoardPlacement = { position: [0, 0.9, 1.05], rotation: [0.5, 0, 0], cell: 0.22 }

const cabLook: CabinetLook = { face: '#efe7d6', side: '#d8c9a8', ink: '#1b1b1b', accent: '#8a2b2b', frame: '#151b1d' }
const boxLook: BoxLook = { sleeve: '#d8c9a8', tray: '#ece2cc', face: '#efe7d6', ink: '#1b1b1b', accent: '#8a2b2b' }

const caseW = CABINET.w * 0.12 + 0.3
const caseH = CABINET.h * 0.12 + 0.25

function Drift() {
  const { camera, size } = useThree()
  useFrame(({ clock }) => {
    const portrait = size.width < size.height
    const a = Math.sin(clock.elapsedTime * 0.12) * 0.28
    const r = portrait ? 6.4 : 4.4
    camera.position.set(Math.sin(a) * r, portrait ? 3.1 : 2.45, 0.4 + Math.cos(a) * r)
    camera.lookAt(0, portrait ? 1.05 : 1.15, 0.3)
  })
  return null
}

function SceneB() {
  const turn = useGame((s) => s.turn)
  const placeMenace = useGame((s) => s.placeMenace)
  return (
    <>
      <color attach="background" args={['#07090a']} />
      <fog attach="fog" args={['#07090a', 5, 13]} />
      <Drift />
      <ambientLight intensity={0.12} />
      <Spot position={[0, 4.4, 0.9]} target={[0, 1.4, -0.3]} angle={0.32} penumbra={0.7} intensity={70} color="#fff3df" castShadow shadow-bias={-0.0004} />
      <Spot position={[0, 4.2, 2.6]} target={[0, 0.9, 1.05]} angle={0.28} penumbra={0.8} intensity={38} color="#e8f1ff" castShadow />
      <Spot position={[-3, 3, -2]} target={[0, 1, -0.3]} angle={0.4} penumbra={1} intensity={14} color="#4fb7a8" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[30, 30]} /><meshStandardMaterial color="#101618" roughness={0.35} metalness={0.2} /></mesh>
      {/* plinth */}
      <mesh position={[0, 0.5, -0.3]} castShadow receiveShadow><boxGeometry args={[caseW + 0.3, 1, 0.9]} /><meshStandardMaterial color="#1b2528" roughness={0.6} /></mesh>
      <Cabinet placement={CAB} hidden={turn?.box ?? null} look={cabLook} />
      {/* glass case */}
      <mesh position={[0, 1 + caseH / 2, -0.3]}>
        <boxGeometry args={[caseW, caseH, 0.6]} />
        <meshStandardMaterial color="#bfe3e8" transparent opacity={0.07} roughness={0.05} depthWrite={false} />
        <Edges color="#7f9ca0" />
      </mesh>
      {/* lectern */}
      <mesh position={[0, 0.42, 1.05]} castShadow><boxGeometry args={[0.26, 0.84, 0.26]} /><meshStandardMaterial color="#1b2528" roughness={0.6} /></mesh>
      <Board
        placement={BOARD}
        look={{ x: '#e2574c', o: '#f1e6cf', glow: true, height: 0.012, lift: 0.03 }}
        base={
          <>
            <mesh position={[0, 0.0, 0]} castShadow receiveShadow><boxGeometry args={[0.8, 0.05, 0.8]} /><meshStandardMaterial color="#0e1517" roughness={0.4} metalness={0.3} /></mesh>
            {[-0.5, 0.5].map((o) => (
              <group key={o}>
                <mesh position={[o * 0.22, 0.027, 0]}><boxGeometry args={[0.006, 0.004, 0.62]} /><meshStandardMaterial color="#3fb7a8" emissive="#3fb7a8" emissiveIntensity={1.6} /></mesh>
                <mesh position={[0, 0.027, o * 0.22]}><boxGeometry args={[0.62, 0.004, 0.006]} /><meshStandardMaterial color="#3fb7a8" emissive="#3fb7a8" emissiveIntensity={1.6} /></mesh>
              </group>
            ))}
          </>
        }
      />
      {turn && <MenaceTurn key={turn.id} turn={turn} cabinet={CAB} present={PRESENT} board={BOARD} look={boxLook} onPlace={placeMenace} />}
    </>
  )
}

function OverlayB() {
  const { phase, line, score, result, showHow, start, setShowHow } = useGame()
  const inGame = phase !== 'title'
  return (
    <div className="b-ui">
      <aside className={`b-placard ${inGame ? 'b-placard--compact' : ''}`}>
        <p className="b-exhibit">Exhibit 1961.03 · Edinburgh</p>
        <h1>MENACE</h1>
        <p className="b-sub">Machine Educable Noughts And Crosses Engine</p>
        {!inGame && (
          <>
            <p className="b-body">Built by Donald Michie from 304 matchboxes and a bag of coloured beads. It began knowing nothing. It learned by playing. Visitors are invited to play against it.</p>
            <div className="b-links">
              <button className="b-link b-link--primary" onClick={start}>Begin a game →</button>
              <button className="b-link" onClick={() => setShowHow(true)}>How it works</button>
            </div>
          </>
        )}
        {phase === 'over' && result && (
          <div className="b-result">
            <p>{RESULT_TITLE[result]}</p>
            <button className="b-link b-link--primary" onClick={start}>Play again →</button>
          </div>
        )}
      </aside>
      {inGame && (
        <>
          <table className="b-score">
            <tbody>
              <tr><th>MENACE</th><td>{score.menace}</td></tr>
              <tr><th>Visitors</th><td>{score.you}</td></tr>
              <tr><th>Drawn</th><td>{score.draws}</td></tr>
            </tbody>
          </table>
          <p className="b-caption" key={line}><span>MENACE</span>{line}</p>
        </>
      )}
      {showHow && (
        <div className="b-modal" onClick={() => setShowHow(false)}>
          <div className="b-card" onClick={(e) => e.stopPropagation()}>
            <p className="b-exhibit">Audio guide</p>
            <h2>How it works</h2>
            {HOW_STEPS.map((s, i) => (
              <div className="b-step" key={s.title}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{s.title}</h3><p>{s.body}</p></div></div>
            ))}
            <button className="b-link b-link--primary" onClick={() => setShowHow(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function VariantB() {
  return (
    <div className="proto vB">
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 38, near: 0.05, far: 40 }}>
        <SceneB />
      </Canvas>
      <OverlayB />
    </div>
  )
}

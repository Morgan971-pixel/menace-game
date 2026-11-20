// PROTOTYPE: clickable 3x3 board in its own local XZ plane, plus X / O marks.
import { useCursor } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import { useGame } from './fakeGame'
import { euler, squareLocal, type BoardPlacement } from './geometry'

export interface MarkLook {
  x: string
  o: string
  glow?: boolean
  height: number // thickness of the mark
  lift: number // y offset above board surface
  chunky?: boolean
}

function Pop({ children, y }: { children: ReactNode; y: number }) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    const s = g.scale.x + (1 - g.scale.x) * Math.min(1, dt * 14)
    g.scale.setScalar(s)
  })
  return <group ref={ref} position={[0, y, 0]} scale={0.01}>{children}</group>
}

function Mark({ kind, cell, look, ghost }: { kind: 'X' | 'O'; cell: number; look: MarkLook; ghost?: boolean }) {
  const color = kind === 'X' ? look.x : look.o
  const mat = (
    <meshStandardMaterial
      color={color}
      roughness={look.glow ? 0.4 : 0.7}
      emissive={look.glow ? color : '#000000'}
      emissiveIntensity={look.glow ? 1.4 : 0}
      transparent={ghost}
      opacity={ghost ? 0.3 : 1}
    />
  )
  const len = cell * 0.68
  const thick = cell * (look.chunky ? 0.17 : 0.07)
  if (kind === 'X')
    return (
      <group>
        <mesh rotation={[0, Math.PI / 4, 0]} castShadow><boxGeometry args={[len, look.height, thick]} />{mat}</mesh>
        <mesh rotation={[0, -Math.PI / 4, 0]} castShadow><boxGeometry args={[len, look.height, thick]} />{mat}</mesh>
      </group>
    )
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={[cell * 0.27, thick / 2, look.chunky ? 16 : 8, 40]} />
      {mat}
    </mesh>
  )
}

export function Board({ placement, look, base, tile }: {
  placement: BoardPlacement
  look: MarkLook
  base?: ReactNode
  tile?: (i: number, hovered: boolean) => ReactNode
}) {
  const board = useGame((s) => s.board)
  const phase = useGame((s) => s.phase)
  const winLine = useGame((s) => s.winLine)
  const playerMove = useGame((s) => s.playerMove)
  const [hover, setHover] = useState<number | null>(null)
  const playable = phase === 'player'
  useCursor(hover !== null && playable && !board[hover])
  const { cell } = placement

  let bar: ReactNode = null
  if (winLine) {
    const a = squareLocal(winLine[0], cell)
    const b = squareLocal(winLine[2], cell)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const len = a.distanceTo(b) + cell * 0.7
    const winner = board[winLine[0]]
    bar = (
      <Pop y={look.lift + look.height}>
        <mesh position={[mid.x, 0, mid.z]} rotation={[0, -Math.atan2(b.z - a.z, b.x - a.x), 0]}>
          <boxGeometry args={[len, look.height, cell * 0.06]} />
          <meshStandardMaterial color={winner === 'X' ? look.x : look.o} emissive={winner === 'X' ? look.x : look.o} emissiveIntensity={look.glow ? 2 : 0.3} />
        </mesh>
      </Pop>
    )
  }

  return (
    <group position={placement.position} rotation={euler(placement)} scale={placement.scale ?? 1}>
      {base}
      {board.map((c, i) => {
        const p = squareLocal(i, cell)
        const hovered = hover === i && playable && !c
        return (
          <group key={i} position={p}>
            {tile?.(i, hovered)}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, look.lift + 0.002, 0]}
              onPointerOver={(e) => { e.stopPropagation(); setHover(i) }}
              onPointerOut={() => setHover((h) => (h === i ? null : h))}
              onClick={(e) => { e.stopPropagation(); playerMove(i) }}
            >
              <planeGeometry args={[cell * 0.96, cell * 0.96]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            {c && <Pop y={look.lift + look.height / 2}><Mark kind={c} cell={cell} look={look} /></Pop>}
            {hovered && <group position={[0, look.lift + look.height / 2, 0]}><Mark kind="O" cell={cell} look={look} ghost /></group>}
          </group>
        )
      })}
      {bar}
    </group>
  )
}

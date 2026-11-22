// The board: a sheet of paper with an inked grid. Each square carries its number (the key
// that plays it) and a dot in its bead colour, so a bead's colour maps to a square at a glance.
import { useCursor } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CanvasTexture, SRGBColorSpace, Vector3, type Group } from 'three'
import type { Cell } from '../engine/board'
import { game, useGame } from '../state/store'
import { BEAD_COLORS, euler, markOffset, PALETTE, squareLocal } from './geometry'
import { useLayout } from './layout'

const SHEET = { w: 1.0, h: 1.08 }
const INK_H = 0.006 // mark thickness
const LIFT = 0.003

function paperTexture(cell: number, typewriter: boolean): CanvasTexture {
  const px = 1024
  const c = document.createElement('canvas')
  c.width = px
  c.height = Math.round((px * SHEET.h) / SHEET.w)
  const g = c.getContext('2d')
  if (!g) throw new Error('2D canvas is not available for the paper')
  const s = px / SHEET.w // pixels per metre
  const cx = c.width / 2
  const cy = c.height / 2
  g.fillStyle = PALETTE.paper
  g.fillRect(0, 0, c.width, c.height)
  // faint ruled lines
  g.strokeStyle = 'rgba(80, 120, 140, 0.18)'
  g.lineWidth = 2
  for (let y = 40; y < c.height; y += 34) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(c.width, y)
    g.stroke()
  }
  // margin line
  g.strokeStyle = 'rgba(168, 50, 45, 0.35)'
  g.beginPath()
  g.moveTo(70, 0)
  g.lineTo(70, c.height)
  g.stroke()
  // the grid, inked by hand
  const half = cell * 1.45 * s
  g.strokeStyle = PALETTE.ink
  g.lineCap = 'round'
  g.lineWidth = 9
  for (const o of [-0.5, 0.5]) {
    g.beginPath()
    g.moveTo(cx + o * cell * s, cy - half)
    g.lineTo(cx + o * cell * s + 3, cy + half)
    g.stroke()
    g.beginPath()
    g.moveTo(cx - half, cy + o * cell * s)
    g.lineTo(cx + half, cy + o * cell * s - 3)
    g.stroke()
  }
  // square numbers and bead-colour dots, top-left of each square
  g.textAlign = 'left'
  g.textBaseline = 'top'
  g.font = typewriter ? '700 56px "Special Elite", monospace' : '700 56px "Courier New", monospace'
  for (let i = 0; i < 9; i++) {
    const p = squareLocal(i, cell)
    const x = cx + (p.x - cell / 2) * s + 16
    const y = cy + (p.z - cell / 2) * s + 14
    g.fillStyle = BEAD_COLORS[i]
    g.beginPath()
    g.arc(x + 18, y + 24, 18, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(31, 42, 48, 0.7)'
    g.lineWidth = 3
    g.stroke()
    g.fillStyle = 'rgba(31, 42, 48, 0.8)'
    g.fillText(String(i + 1), x + 44, y)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

function Pop({ children, y }: { children: ReactNode; y: number }) {
  const ref = useRef<Group>(null)
  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    g.scale.setScalar(g.scale.x + (1 - g.scale.x) * Math.min(1, dt * 14))
  })
  return <group ref={ref} position={[0, y, 0]} scale={0.01}>{children}</group>
}

function Mark({ kind, cell, ghost = false }: { kind: 'X' | 'O'; cell: number; ghost?: boolean }) {
  const color = kind === 'X' ? PALETTE.brick : PALETTE.ink
  const mat = <meshStandardMaterial color={color} roughness={0.6} transparent={ghost} opacity={ghost ? 0.3 : 1} />
  const len = cell * 0.58
  const thick = cell * 0.085
  if (kind === 'X') {
    return (
      <group>
        <mesh rotation={[0, Math.PI / 4, 0]} castShadow={!ghost}><boxGeometry args={[len, INK_H, thick]} />{mat}</mesh>
        <mesh rotation={[0, -Math.PI / 4, 0]} castShadow={!ghost}><boxGeometry args={[len, INK_H, thick]} />{mat}</mesh>
      </group>
    )
  }
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow={!ghost}>
      <torusGeometry args={[cell * 0.215, thick / 2, 10, 48]} />
      {mat}
    </mesh>
  )
}

function WinBar({ line, board, cell }: { line: readonly number[]; board: Cell[]; cell: number }) {
  const a = squareLocal(line[0], cell)
  const b = squareLocal(line[2], cell)
  const mid = a.clone().add(b).multiplyScalar(0.5)
  const len = a.distanceTo(b) + cell * 0.75
  const color = board[line[0]] === 'X' ? PALETTE.brick : PALETTE.ink
  return (
    <Pop y={LIFT + INK_H * 1.5}>
      <mesh position={[mid.x, 0, mid.z]} rotation={[0, -Math.atan2(b.z - a.z, b.x - a.x), 0]}>
        <boxGeometry args={[len, INK_H, cell * 0.09]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>
    </Pop>
  )
}

export function Board() {
  const board = useGame((s) => s.board)
  const phase = useGame((s) => s.phase)
  const winLine = useGame((s) => s.winLine)
  const [hover, setHover] = useState<number | null>(null)
  const playable = phase === 'player'
  useCursor(hover !== null && playable && board[hover] === null)
  const at = useLayout().board
  const { cell } = at
  // Redraw the paper once the typewriter face has loaded, so the square numbers use it.
  const [fontReady, setFontReady] = useState(false)
  useEffect(() => {
    let live = true
    document.fonts
      .load('700 30px "Special Elite"')
      .catch(() => [])
      .then(() => { if (live) setFontReady(true) })
    return () => { live = false }
  }, [])
  const paper = useMemo(() => paperTexture(cell, fontReady), [cell, fontReady])
  const sheet = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  // Dev only: the paper's screen rectangle, so a check can prove nothing is laid over the board.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __boardRect?: () => { left: number; top: number; right: number; bottom: number } | null }
    w.__boardRect = () => {
      const g = sheet.current
      if (!g) return null
      g.updateWorldMatrix(true, false)
      camera.updateMatrixWorld()
      const xs: number[] = []
      const ys: number[] = []
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const v = new Vector3((x * SHEET.w) / 2, 0, (z * SHEET.h) / 2).applyMatrix4(g.matrixWorld).project(camera)
        xs.push(((v.x + 1) / 2) * size.width)
        ys.push(((1 - v.y) / 2) * size.height)
      }
      return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
    }
    return () => { delete w.__boardRect }
  }, [camera, size])
  useEffect(() => () => paper.dispose(), [paper])

  return (
    <group ref={sheet} position={at.position} rotation={euler(at)}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[SHEET.w, SHEET.h]} />
        <meshStandardMaterial map={paper} roughness={0.95} />
      </mesh>
      {board.map((c, i) => {
        const p = squareLocal(i, cell)
        const hovered = hover === i && playable && c === null
        return (
          <group key={i} position={p}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, LIFT + 0.002, 0]}
              onPointerOver={(e) => { e.stopPropagation(); setHover(i) }}
              onPointerOut={() => setHover((h) => (h === i ? null : h))}
              onClick={(e) => { e.stopPropagation(); game.getState().play(i) }}
            >
              <planeGeometry args={[cell * 0.96, cell * 0.96]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <group position={markOffset(cell)}>
              {c && <Pop y={LIFT + INK_H / 2}><Mark kind={c} cell={cell} /></Pop>}
              {hovered && <group position={[0, LIFT + INK_H / 2, 0]}><Mark kind="O" cell={cell} ghost /></group>}
            </group>
          </group>
        )
      })}
      {winLine && (
        <group position={markOffset(cell)}>
          <WinBar line={winLine} board={board} cell={cell} />
        </group>
      )}
    </group>
  )
}

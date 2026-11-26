// The "it has learned" beat: the first time MENACE goes STREAK_GOAL games unbeaten, a warm light
// swells over the whole cabinet and fades, once. The store bumps `milestone` as the ledger closes;
// this reacts to the change, never to the value on load, so a reload does not replay it.
// Reduced motion: a short steady glow instead of the swell.
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { PointLight } from 'three'
import { cabinetAt, cabinetSize, gridFor, PALETTE } from './geometry'
import { useGame } from '../state/store'
import { reducedMotion } from './motion'

const SECONDS = 3.2
const PEAK = 6


/** Light level t seconds into the beat: rises, holds, falls. 0 outside the beat. */
function beatLevel(t: number, still: boolean): number {
  if (t < 0 || t >= SECONDS) return 0
  if (still) return t < SECONDS * 0.6 ? PEAK * 0.6 : 0
  const x = t / SECONDS
  return PEAK * Math.sin(Math.PI * Math.min(1, x * 1.4)) * (1 - x * 0.3)
}

export function Milestone() {
  const count = useGame((s) => s.milestone)
  const rules = useGame((s) => s.brain.config.rules)
  const light = useRef<PointLight>(null)
  const startAt = useRef<number | null>(null)
  const seen = useRef(count)

  useEffect(() => {
    if (count > seen.current) startAt.current = -1
    seen.current = count
  }, [count])

  useFrame(({ clock }) => {
    const l = light.current
    if (l === null || startAt.current === null) return
    // -1: started this frame.
    if (startAt.current < 0) startAt.current = clock.elapsedTime
    const t = clock.elapsedTime - startAt.current
    l.intensity = beatLevel(t, reducedMotion())
    if (t >= SECONDS) {
      l.intensity = 0
      startAt.current = null
    }
  })

  const at = cabinetAt(rules)
  const S = at.scale ?? 1
  const size = cabinetSize(gridFor(rules))
  const [x, y, z] = at.position
  return <pointLight ref={light} position={[x, y + (size.h / 2) * S, z + 1.1 * S]} color={PALETTE.lamp} intensity={0} decay={1.4} distance={5} />
}

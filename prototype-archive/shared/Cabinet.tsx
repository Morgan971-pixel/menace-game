// PROTOTYPE: 304 matchboxes in one InstancedMesh, set into a chest-of-drawers frame.
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { BOX, CABINET, euler, makeLabelTexture, slotLocal, type Placement } from './geometry'

export interface CabinetLook {
  face: string
  side: string
  ink: string
  accent: string
  frame: string
  rounded?: boolean
  tints?: string[]
}

const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function Cabinet({ placement, hidden, look }: { placement: Placement; hidden: number | null; look: CabinetLook }) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(
    () => (look.rounded ? new RoundedBoxGeometry(BOX.w, BOX.h, BOX.d, 2, 0.05) : new BoxGeometry(BOX.w, BOX.h, BOX.d)),
    [look.rounded],
  )
  const material = useMemo(() => {
    if (look.rounded) return new MeshStandardMaterial({ color: '#ffffff', roughness: 0.55 })
    const side = new MeshStandardMaterial({ color: look.side, roughness: 0.85 })
    const label = new MeshStandardMaterial({
      map: makeLabelTexture({ bg: look.face, ink: look.ink, accent: look.accent }),
      roughness: 0.8,
    })
    return [side, side, side, side, label, side]
  }, [look])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const c = new Color()
    for (let i = 0; i < 304; i++) {
      if (i === hidden) m.makeScale(0, 0, 0)
      else m.makeTranslation(slotLocal(i))
      mesh.setMatrixAt(i, m)
      if (look.tints) c.set(look.tints[Math.floor(hash(i) * look.tints.length)])
      else c.setScalar(0.82 + 0.18 * hash(i))
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [hidden, look])

  const frameArgs: [number, number, number] = [CABINET.w + 0.4, CABINET.h + 0.3, BOX.d]
  return (
    <group position={placement.position} rotation={euler(placement)} scale={placement.scale ?? 1}>
      <instancedMesh ref={ref} args={[geometry, material, 304]} castShadow receiveShadow />
      {look.rounded ? (
        <mesh position={[0, CABINET.h / 2, -0.1]} castShadow receiveShadow>
          <primitive object={new RoundedBoxGeometry(...frameArgs, 3, 0.15)} attach="geometry" />
          <meshStandardMaterial color={look.frame} roughness={0.6} />
        </mesh>
      ) : (
        <mesh position={[0, CABINET.h / 2, -0.08]} castShadow receiveShadow>
          <boxGeometry args={frameArgs} />
          <meshStandardMaterial color={look.frame} roughness={0.7} />
        </mesh>
      )}
    </group>
  )
}

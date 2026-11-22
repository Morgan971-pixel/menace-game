// Green banker's lamp: the warm key light. Its spot is the only shadow caster on the desk,
// with a tight frustum, a 2048 map and normal bias, so shadows on the paper stay smooth.
import { useMemo } from 'react'
import { Object3D } from 'three'
import { PALETTE } from './geometry'
import { useLayout } from './layout'

const BRASS = '#a88d55'

export function Lamp() {
  // The spot aims at a target object that lives in the scene, centred on the paper.
  const board = useLayout().board
  const aim = useMemo(() => {
    const o = new Object3D()
    const [x, y, z] = board.position
    o.position.set(x + 0.1, y, z)
    return o
  }, [board])

  return (
    <>
      <group position={[1.75, 0, -1.0]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.19, 0.04, 32]} />
          <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.72, 12]} />
          <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.32} />
        </mesh>
        <group position={[0.18, 0.74, 0.22]} rotation={[0.35, -0.6, 0]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.24, 0.16, 32, 1, true]} />
            <meshStandardMaterial color="#1f6b4f" roughness={0.25} metalness={0.2} side={2} />
          </mesh>
          <mesh position={[0, -0.04, 0]}>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshStandardMaterial color="#ffffff" emissive={PALETTE.lamp} emissiveIntensity={3} />
          </mesh>
        </group>
      </group>

      {/* glow around the lamp itself, no shadow */}
      <pointLight position={[1.5, 0.7, -0.78]} color={PALETTE.lamp} intensity={2.2} decay={2} distance={3} />
      {/* key light from the shade onto the paper and the presented box */}
      <primitive object={aim} />
      <spotLight
        target={aim}
        position={[1.45, 0.92, -0.72]}
        angle={0.62}
        penumbra={0.7}
        intensity={4}
        decay={0.6}
        color={PALETTE.lamp}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-radius={3}
        shadow-camera-near={0.2}
        shadow-camera-far={4}
      />
      {/* soft overhead pool on the paper, no shadows, so the board stays clearly lit */}
      <spotLight target={aim} position={[board.position[0] + 0.2, 2.4, board.position[2] + 0.55]} angle={0.3} penumbra={0.9} intensity={4.5} decay={0} color={PALETTE.lamp} />
    </>
  )
}

// The study: teal wall, walnut desk, the dish of confiscated beads and a pencil.
import { useDishBeads } from './dishBeads'
import { DISH, dishSpot, PALETTE, type V3 } from './geometry'
import { beadGeometry, beadMaterials } from './boxParts'

function Dish({ at }: { at: V3 }) {
  // The tail is the newest 48 beads; past the drawn layers they take the top spots.
  const visible = useDishBeads().tail
  return (
    <group position={at}>
      {/* bowl: a glazed outer wall, a dark well, and a thick rim so it reads as a dish, not a plate */}
      <mesh position={[0, DISH.h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[DISH.r, DISH.r * 0.75, DISH.h, 40, 1, true]} />
        <meshStandardMaterial color="#e9e2d2" roughness={0.3} side={2} />
      </mesh>
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[DISH.r * 0.76, 40]} />
        <meshStandardMaterial color="#6a645a" roughness={0.6} />
      </mesh>
      <mesh position={[0, DISH.h, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[DISH.r, 0.012, 10, 48]} />
        <meshStandardMaterial color="#f3ecdc" roughness={0.3} />
      </mesh>
      {visible.map((square, k) => (
        <mesh key={k} position={dishSpot(k)} geometry={beadGeometry} material={beadMaterials[square]} scale={DISH.bead} castShadow />
      ))}
    </group>
  )
}

export function Desk({ dish }: { dish: V3 }) {
  return (
    <>
      <mesh position={[0, 1.2, -2.0]} receiveShadow>
        <planeGeometry args={[9, 4]} />
        <meshStandardMaterial color={PALETTE.wall} roughness={0.95} />
      </mesh>
      {/* skirting board where the wall meets the desk */}
      <mesh position={[0, 0.05, -1.97]}>
        <boxGeometry args={[9, 0.1, 0.04]} />
        <meshStandardMaterial color="#14292c" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.04, -0.25]} receiveShadow>
        <boxGeometry args={[4.6, 0.08, 3.6]} />
        <meshStandardMaterial color={PALETTE.desk} roughness={0.55} />
      </mesh>

      <Dish at={dish} />

      {/* pencil */}
      {/* pencil, along its local y: eraser and ferrule at -y, sharpened wood and graphite at +y */}
      <group position={[1.0, 0.012, -0.1]} rotation={[0, 0.9, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.34, 6]} />
          <meshStandardMaterial color="#2f6e5c" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.195, 0]} castShadow>
          <cylinderGeometry args={[0.0035, 0.012, 0.05, 6]} />
          <meshStandardMaterial color="#d8b98a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.227, 0]}>
          <coneGeometry args={[0.0035, 0.014, 12]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.4} metalness={0.3} />
        </mesh>
        <mesh position={[0, -0.1825, 0]} castShadow>
          <cylinderGeometry args={[0.0128, 0.0128, 0.025, 16]} />
          <meshStandardMaterial color="#b9b2a3" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.205, 0]} castShadow>
          <cylinderGeometry args={[0.0118, 0.0118, 0.02, 16]} />
          <meshStandardMaterial color="#c9848a" roughness={0.9} />
        </mesh>
      </group>
    </>
  )
}

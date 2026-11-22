// MENACE's line on a typed paper slip, pinned to the cabinet in the 3D scene (drei Html).
// Wide screens: hung off the cabinet's top-left corner, over the empty wall.
// Tall screens: above the cabinet. Either way it stays clear of the board.
import { Html } from '@react-three/drei'
import { cabinetAt, cabinetSize, gridFor, type V3 } from '../scene/geometry'
import { useInspecting } from '../state/inspecting'
import { useGame } from '../state/store'

const spot = (rules: '1961' | 'engine') => {
  const at = cabinetAt(rules)
  const [cx, cy, cz] = at.position
  const S = at.scale ?? 1
  const size = cabinetSize(gridFor(rules))
  return { cx, cz, top: cy + (size.h + 0.3) * S, left: cx - (size.w / 2 + 0.2) * S }
}

export function Speech({ tall }: { tall: boolean }) {
  const phase = useGame((s) => s.phase)
  const speech = useGame((s) => s.speech)
  const rules = useGame((s) => s.brain.config.rules)
  // The inspector panel sits where the slip hangs; the slip returns when it closes.
  const inspecting = useInspecting()
  if (phase === 'title' || !speech || inspecting) return null
  const { cx, cz, top, left } = spot(rules)
  const at: V3 = tall ? [cx, top, cz] : [left, top - 0.08, cz]
  return (
    <Html position={at} zIndexRange={[20, 0]} pointerEvents="none">
      {/* One stable status element; the keyed inner span replays the typing effect per line. */}
      <div className={`slip ${tall ? 'slip--above' : 'slip--left'}`} role="status">
        <span key={speech} className="slip__line">
          <span className="slip__who">MENACE:</span> {speech}
        </span>
      </div>
    </Html>
  )
}

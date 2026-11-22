// The two first-game tips. Neither takes input (pointer-events none) and Escape dismisses the
// one on top through the escape stack. They sit clear of the paper board (checked by boardGuard).
import { Html } from '@react-three/drei'
import { useGame } from '../state/store'
import { useTips, tips } from '../state/tips'
import type { Placement } from '../scene/geometry'
import { useEscape } from './useEscape'

const BOX_TIP = "This is MENACE's box for this exact position. Watch which bead it draws."

const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
const turnTipText = (touch: boolean) => `Your move. ${touch ? 'Tap' : 'Click'} a square or press 1 to 9.`

/** Pinned beside the presented box, for as long as the box is out on the first turn. */
export function BoxTip({ present, tall }: { present: Placement; tall: boolean }) {
  const on = useTips((s) => s.on && !s.boxDone)
  const out = useGame((s) => (s.phase === 'menace' || s.phase === 'player') && s.boxOut && s.turn !== null && !s.turn.forced)
  const visible = on && out
  useEscape(() => tips.getState().dismissBox(), visible)
  if (!visible) return null
  return (
    <Html position={present.position} zIndexRange={[18, 0]} pointerEvents="none">
      <div className={`tip tip--box ${tall ? 'tip--box-tall' : 'tip--box-wide'}`} role="status">
        <span className="tip__arrow" aria-hidden="true" />
        {BOX_TIP}
        <span className="tip__esc">Esc hides tips</span>
      </div>
    </Html>
  )
}

/** The player's first turn: sits at the bottom, under the board. */
export function TurnTip() {
  const wanted = useTips((s) => s.on && !s.turnDone)
  const yours = useGame((s) => s.phase === 'player')
  const boxOut = useGame((s) => s.boxOut)
  const visible = wanted && yours && !boxOut
  useEscape(() => tips.getState().dismissTurn(), visible)
  return (
    <>
      {/* Screen readers always hear whose move it is. */}
      <p className="visually-hidden" role="status">
        {yours ? 'Your move. Press 1 to 9 to play a square.' : ''}
      </p>
      {visible && (
        <p className="hint tip tip--turn" role="status">
          {turnTipText(coarse())}
          <span className="tip__esc">Esc hides tips</span>
        </p>
      )}
    </>
  )
}

import { useRef } from 'react'
import { game, useGame } from '../state/store'
import { bestLine } from './challengeText'
import { useInspecting } from '../state/inspecting'
import { InspectButton } from './InspectButton'

export function GameOver({ onTrain, onCurve, onTinker }: { onTrain: () => void; onCurve: () => void; onTinker: () => void }) {
  const training = useGame((s) => s.training !== null)
  const result = useGame((s) => s.result)
  const resigned = useGame((s) => s.resigned)
  // Skipping the ledger with the inspector open must not pull focus out of the inspector.
  const inspecting = useInspecting()
  // Keyboard activation only counts if the key went down while this button had focus.
  // Otherwise a held Enter/Space that skipped the ledger would repeat (or release) into
  // Play again and start a new game before the result is seen.
  const armed = useRef(false)
  const challenge = useGame((s) => s.challenge)
  const best = useGame((s) => s.challengeBest)
  if (result === null) return null
  const outcome = challenge?.outcome ?? null
  const title =
    outcome === 'won' ? 'Challenge won'
    : outcome === 'lost' ? 'Locked out'
    : resigned ? 'MENACE resigns' : result === 'X' ? 'MENACE wins' : result === 'O' ? 'You win' : 'A draw'
  return (
    <section className={`over over--${result}`} role="alert">
      <h2>{title}</h2>
      {outcome !== null && <p className="over__best">{bestLine(best)}</p>}
      {outcome === null && <button
        className="btn btn--primary"
        disabled={training}
        autoFocus={!inspecting}
        onKeyDown={(e) => {
          if (e.repeat) e.preventDefault()
          else if (e.key === 'Enter' || e.key === ' ') armed.current = true
        }}
        onClick={(e) => {
          const fromKeyboard = e.detail === 0
          if (fromKeyboard && !armed.current) return
          game.getState().start()
        }}
      >
        Play again
      </button>}
      {challenge !== null && (
        <button className={`btn${outcome !== null ? ' btn--primary' : ''}`} autoFocus={outcome !== null && !inspecting} onClick={() => game.getState().endChallenge()}>
          End challenge
        </button>
      )}
      <div className="over__more">
        {challenge === null && <button className="btn btn--small" disabled={training} onClick={() => game.getState().startChallenge()}>Challenge</button>}
        {challenge === null && <button className="btn btn--small" onClick={onTrain}>Train</button>}
        <button className="btn btn--small" onClick={onCurve}>Curve</button>
        {challenge === null && <button className="btn btn--small" onClick={onTinker}>Tinker</button>}
        <InspectButton />
      </div>
    </section>
  )
}

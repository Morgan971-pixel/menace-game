// The learning curve panel: the whole history of results, or just the latest run, between games.
import { useId, useState } from 'react'
import { curveTotal, latestRunStart } from '../state/curve'
import { useGame } from '../state/store'
import { CurveChart } from './CurveChart'
import { useEscape } from './useEscape'

export function CurvePanel({ onClose }: { onClose: () => void }) {
  const curve = useGame((s) => s.curve)
  const trained = useGame((s) => s.trained)
  const [latest, setLatest] = useState(false)
  const id = useId()
  useEscape(onClose)
  const total = curveTotal(curve)
  const start = latestRunStart(curve)
  const showLatest = latest && start !== null
  return (
    <section className="panel panel--curve" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="panel__title">Learning curve</h2>
      <p className="panel__sub">
        {total.toLocaleString('en-US')} games, {trained.toLocaleString('en-US')} of them training.
      </p>
      <div className="choice__row" role="radiogroup" aria-label="Range">
        {[
          { v: false, text: 'All' },
          { v: true, text: 'Latest run' },
        ].map((o) => (
          <button
            key={o.text}
            role="radio"
            aria-checked={showLatest === o.v}
            className={`choice__opt${showLatest === o.v ? ' choice__opt--on' : ''}`}
            disabled={o.v && start === null}
            tabIndex={showLatest === o.v ? 0 : -1}
            onClick={() => setLatest(o.v)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                if (start !== null) setLatest(!showLatest)
              }
            }}
          >
            {o.text}
          </button>
        ))}
      </div>
      <CurveChart curve={curve} height={210} from={showLatest ? (start ?? 0) : 0} />
      <div className="panel__row">
        <button className="btn btn--small btn--primary" autoFocus onClick={onClose}>Close</button>
      </div>
    </section>
  )
}

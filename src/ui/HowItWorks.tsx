import { howSteps, howSymmetry } from '../state/lines'
import { useGame } from '../state/store'
import { useEscape } from './useEscape'

export function HowItWorks({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const config = useGame((s) => s.brain.config)

  return (
    <div className="modal" onClick={onClose}>
      <div className="card" role="dialog" aria-modal="true" aria-labelledby="how-heading" onClick={(e) => e.stopPropagation()}>
        <h2 id="how-heading">How it works</h2>
        <ol className="steps">
          {howSteps(config).map((s, i) => (
            <li key={s.title} className="step">
              <span className="step__num" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="how__note">{howSymmetry(config)}</p>
        <button className="btn btn--primary" onClick={onClose} autoFocus>Got it</button>
      </div>
    </div>
  )
}

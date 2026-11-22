import { game, useGame } from '../state/store'
import { InspectButton } from './InspectButton'

export function Title({ onHow, onTrain, onCurve, onTinker, hidden }: { onHow: () => void; onTrain: () => void; onCurve: () => void; onTinker: () => void; hidden?: boolean }) {
  const training = useGame((s) => s.training !== null)
  const engine = useGame((s) => s.brain.config.rules === 'engine')
  return (
    <section className="title" hidden={hidden} aria-labelledby="title-heading">
      <p className="title__kicker">Edinburgh, 1961</p>
      <h1 id="title-heading">MENACE</h1>
      <p className="title__tag">{engine ? 'Matchboxes, made as it needs them.' : '304 matchboxes.'} It learns from every mistake you let it make.</p>
      <div className="title__actions">
        <button className="btn btn--primary" disabled={training} onClick={() => game.getState().start()}>Play</button>
        <button className="btn" onClick={onHow} aria-haspopup="dialog">How it works</button>
        <button className="btn btn--small" onClick={onTrain}>Train</button>
        <button className="btn btn--small" onClick={onCurve}>Curve</button>
        <button className="btn btn--small" onClick={onTinker}>Tinker</button>
        <InspectButton />
      </div>
    </section>
  )
}

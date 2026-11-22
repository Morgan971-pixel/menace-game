// The Train panel: pick an opponent and a number of games, then watch the curve move.
// Open only between games (the title screen or game over). The run itself lives in the store;
// useTrainDriver steps it a chunk per animation frame.
import { useEffect, useId, useRef, useState } from 'react'
import { OPPONENT_KINDS, OPPONENT_NAMES, TRAIN_SIZES, game, useGame, type OpponentKind } from '../state/store'
import { curveTotal, latestRunShare, latestRunStart } from '../state/curve'
import { CurveChart } from './CurveChart'
import { Choice } from './Choice'
import { useEscape } from './useEscape'

export function TrainPanel({ onClose }: { onClose: () => void }) {
  const training = useGame((s) => s.training)
  const curve = useGame((s) => s.curve)
  const trained = useGame((s) => s.trained)
  const speech = useGame((s) => s.speech)
  const [opponent, setOpponent] = useState<OpponentKind>('random')
  const [n, setN] = useState(100)
  const [ran, setRan] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const id = useId()

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('[role=radio][aria-checked=true]')?.focus()
  }, [])

  // Escape stops a run, or closes the panel when none is going. Only the newest open layer hears it.
  useEscape(() => {
    if (game.getState().training !== null) game.getState().stopTraining()
    else onClose()
  })

  const running = training !== null
  // When the latest run is a sliver of the history, the small chart shows that run alone.
  const latestOnly = latestRunShare(curve) < 0.1
  const pct = training ? Math.round((training.done / training.total) * 100) : 0

  const start = () => {
    if (game.getState().startTraining(opponent, n)) setRan(true)
  }

  return (
    <section ref={panel} className="panel panel--train" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="panel__title">Train MENACE</h2>
      <p className="panel__sub">{curveTotal(curve).toLocaleString('en-US')} games on the curve, {trained.toLocaleString('en-US')} of them training.</p>

      <Choice label="Opponent" value={opponent} disabled={running} onPick={setOpponent}
        options={OPPONENT_KINDS.map((k) => ({ value: k, text: OPPONENT_NAMES[k] }))} />
      <Choice label="Games" value={n} disabled={running} onPick={setN}
        options={TRAIN_SIZES.map((v) => ({ value: v, text: v.toLocaleString('en-US') }))} />

      {running ? (
        <div className="panel__run">
          <progress className="panel__bar" max={training.total} value={training.done} aria-label="Training progress" />
          <p className="panel__count">{training.done.toLocaleString('en-US')} / {training.total.toLocaleString('en-US')} ({pct}%)</p>
          <button className="btn btn--small btn--primary" onClick={() => game.getState().stopTraining()}>Stop</button>
        </div>
      ) : (
        <div className="panel__row">
          <button className="btn btn--small btn--primary" onClick={start}>Train</button>
          <button className="btn btn--small" onClick={onClose}>Close</button>
        </div>
      )}

      {latestOnly && <p className="chart__mode">Showing the latest run only.</p>}
      <CurveChart curve={curve} height={150} from={latestOnly ? (latestRunStart(curve) ?? 0) : 0} />
      <p className="panel__note" role="status">
        {ran && !running ? `MENACE: ${speech}` : ''}
      </p>
    </section>
  )
}

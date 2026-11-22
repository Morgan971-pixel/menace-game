import { inspector } from '../state/inspector'
import { ledgerLine } from '../state/lines'
import { game, SPEEDS, useGame } from '../state/store'
import { BEAD_COLORS } from '../scene/geometry'

/** The ledger's caption (one stable status region) and the Skip button. Only during the ledger. */
export function LedgerBar() {
  const items = useGame((s) => s.ledger)
  const at = useGame((s) => s.ledgerAt)
  const item = at >= 0 ? items[at] : undefined
  const text = item ? ledgerLine(item) : 'Settling the books...'
  return (
    <div className="ledger">
      <p className="ledger__caption" role="status">
        {item && item.square !== null && (
          <i className="ledger__dot" style={{ background: BEAD_COLORS[item.square] }} aria-hidden="true" />
        )}
        <span key={at}>{text}</span>
      </p>
      <p className="ledger__count" aria-hidden="true">
        {item ? `${at + 1} of ${items.length}` : 'The ledger'}
      </p>
      <div className="ledger__btns">
        <button
          className="btn btn--small"
          disabled={!item}
          onClick={() => item && inspector.getState().open(item.slot)}
          aria-label="Inspect this box (pauses the ledger)"
        >
          Inspect
        </button>
        <button className="btn btn--small" onClick={() => game.getState().skipLedger()} aria-keyshortcuts="Space Enter Escape">
          Skip
        </button>
      </div>
    </div>
  )
}

/** 1x, 2x, 4x. The ledger follows it. */
export function SpeedControl() {
  const speed = useGame((s) => s.speed)
  return (
    <div className="speed" role="group" aria-label="Ledger speed">
      {SPEEDS.map((s) => (
        <button key={s} className="speed__btn" aria-pressed={speed === s} onClick={() => game.getState().setSpeed(s)}>
          {s}x
        </button>
      ))}
    </div>
  )
}

// The box inspector: one cabinet box, opened. A mini board shows the box's position; each empty
// square shows its bead colour and number, the exact count, and its share of the box.
// Opened between games (and from the ledger, which waits while it is open). Escape closes it.
import { useEffect, useRef } from 'react'
import { slotCount, slotMade } from '../engine/slots'
import { BEAD_COLORS, gridFor } from '../scene/geometry'
import { boxView, inspector, NAV_KEYS, shareLabel, stepSlot, useInspector, type BoxView, type NavKey } from '../state/inspector'
import { game, useGame } from '../state/store'
import { useEscape } from './useEscape'

const ORDINAL = ['1st', '2nd', '3rd', '4th']

function MiniBoard({ view }: { view: BoxView }) {
  const empty = new Set(view.squares.map((s) => s.square))
  return (
    <svg className="insp__board" viewBox="0 0 90 90" role="img" aria-label={`Position: ${view.cells.map((c, i) => `square ${i + 1} ${c ?? 'empty'}`).join(', ')}`}>
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M30 6V84M60 6V84M6 30H84M6 60H84" />
      </g>
      {view.cells.map((c, i) => {
        const cx = (i % 3) * 30 + 15
        const cy = Math.floor(i / 3) * 30 + 15
        if (c === 'X')
          return <path key={i} d={`M${cx - 8} ${cy - 8}L${cx + 8} ${cy + 8}M${cx + 8} ${cy - 8}L${cx - 8} ${cy + 8}`} stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        if (c === 'O') return <circle key={i} cx={cx} cy={cy} r="9" fill="none" stroke="currentColor" strokeWidth="4" />
        return empty.has(i) ? (
          <g key={i}>
            <circle cx={cx} cy={cy - 5} r="5" fill={BEAD_COLORS[i]} stroke="currentColor" strokeWidth="1.5" />
            <text x={cx} y={cy + 9.5} textAnchor="middle" className="insp__num">{i + 1}</text>
          </g>
        ) : null
      })}
    </svg>
  )
}

function Body({ view, engine }: { view: BoxView; engine: boolean }) {
  const empty = view.total === 0
  const diff = view.total - view.started
  return (
    <>
      <div className="insp__top">
        <MiniBoard view={view} />
        <div className="insp__facts">
          <p className="insp__move">MENACE's {ORDINAL[view.move - 1] ?? `${view.move}th`} move</p>
          <p className="insp__total">
            <b>{view.total}</b> {view.total === 1 ? 'bead' : 'beads'}, started with {view.started}
            {diff !== 0 && <span className={diff > 0 ? 'insp__up' : 'insp__down'}> ({diff > 0 ? '+' : ''}{diff})</span>}
          </p>
        </div>
      </div>
      {empty ? (
        <p className="insp__empty">
          {engine
            ? 'This box holds no beads. MENACE still plays it, weighing each square as 1 bead.'
            : 'This box is empty. MENACE resigns if it reaches this position.'}
        </p>
      ) : (
        <ul className="insp__rows">
          {view.squares.map((s) => (
            <li key={s.square} className="insp__row" aria-label={`Square ${s.square + 1}: ${s.count} ${s.count === 1 ? 'bead' : 'beads'}, ${shareLabel(s.count, s.share)}`}>
              <i className="insp__dot" style={{ background: BEAD_COLORS[s.square] }} aria-hidden="true" />
              <span className="insp__sq">{s.square + 1}</span>
              <span className="insp__count">{s.count}<span className="insp__unit"> {s.count === 1 ? 'bead' : 'beads'}</span><span className="insp__unit-short"> b</span></span>
              <span className="insp__pct">{shareLabel(s.count, s.share)}</span>
              <span className="insp__bar" aria-hidden="true"><span style={{ width: `${s.share}%`, background: BEAD_COLORS[s.square] }} /></span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function Inspector() {
  const slot = useInspector((s) => s.slot)
  const brain = useGame((s) => s.brain)
  const phase = useGame((s) => s.phase)
  const training = useGame((s) => s.training !== null)
  // `games` and `trained` are read only to re-render: learn() mutates the brain in place, so the
  // `brain` reference does not change when a game or a training run teaches it something.
  const games = useGame((s) => s.games)
  const trained = useGame((s) => s.trained)
  const panel = useRef<HTMLElement>(null)
  const open = slot !== null
  // A slot with no box (the brain was replaced by a smaller one) must not leave the screen stuck: close it.
  const stale = slot !== null && boxView(brain, slot) === null
  useEffect(() => {
    if (stale) inspector.getState().close()
  }, [stale])

  const close = () => inspector.getState().close()
  useEscape(close, open)

  // A game or a training run starting closes it; focus returns to whatever opened it.
  useEffect(() => {
    if (open && (phase === 'menace' || phase === 'player' || training)) close()
  }, [open, phase, training])

  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    const el = document.activeElement
    opener.current = el instanceof HTMLElement && el !== document.body ? el : null
    panel.current?.focus({ preventScroll: true })
    return () => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
    }
  }, [open])

  // Arrow keys, Home and End move through the cabinet. A radio group elsewhere keeps its own arrows.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !NAV_KEYS.includes(e.key)) return
      const el = e.target
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (el instanceof HTMLElement && el.closest('[role=radiogroup]')) return
      const cur = inspector.getState().slot
      if (cur === null) return
      e.preventDefault()
      const b = game.getState().brain
      inspector.getState().open(stepSlot(cur, e.key as NavKey, slotCount(b.config.rules), gridFor(b.config.rules).cols, (s) => slotMade(b, s)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (slot === null) return null
  void games
  void trained
  const view = boxView(brain, slot)
  if (view === null) return null
  const engine = brain.config.rules === 'engine'
  // Box numbers are the fixed slot numbers. 1961: all 304 boxes exist, so the live count is the total.
  // Engine: boxes are made as play needs them, so the title shows the 338 it can grow to and the
  // live count goes on its own line.
  const made = brain.boxes.size
  const count = engine ? slotCount('engine') : made
  const go = (key: NavKey) =>
    inspector.getState().open(stepSlot(slot, key, slotCount(brain.config.rules), gridFor(brain.config.rules).cols, (s) => slotMade(brain, s)))
  return (
    <section ref={panel} tabIndex={-1} className="insp" role="dialog" aria-label={`Box ${view.number} of ${count}`}>
      <h2 className="insp__title" aria-live="polite">Box {view.number} of {count}</h2>
      {engine && <p className="insp__made">{made} of {count} boxes made so far</p>}
      <Body view={view} engine={engine} />
      <div className="insp__nav" role="group" aria-label="Move to another box">
        <button className="btn btn--small insp__step" aria-label="Previous box" onClick={() => go('ArrowLeft')}>&lt;</button>
        <button className="btn btn--small insp__step" aria-label="Next box" onClick={() => go('ArrowRight')}>&gt;</button>
        <button className="btn btn--small insp__step" aria-label="Box one row up" onClick={() => go('ArrowUp')}>^</button>
        <button className="btn btn--small insp__step" aria-label="Box one row down" onClick={() => go('ArrowDown')}>v</button>
        <button className="btn btn--small btn--primary insp__close" onClick={close}>Close</button>
      </div>
      <p className="insp__hint">Arrow keys move, Home and End jump, Esc closes.</p>
    </section>
  )
}

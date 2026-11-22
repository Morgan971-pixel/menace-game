// The Tinker panel: rule set, rewards and starting beads. Open only between games.
// Editing changes a draft; Apply commits it. A new rule set or new starting beads needs a fresh
// brain (the old beads would not match), so Apply asks first and then wipes. Rewards alone keep
// the brain: learn() reads them from the config every game.
import { useEffect, useId, useRef, useState } from 'react'
import { defaultConfig, type MenaceConfig, type RuleSet } from '../engine/menace'
import { LIMITS, minStartBeads, sameConfig, sameShape, withBeads, withReward, type RewardKey } from '../state/config'
import { gamesPlayed } from '../state/persist'
import { game, useGame } from '../state/store'
import { Choice } from './Choice'
import { useEscape } from './useEscape'

const RULE_NOTES: Record<RuleSet, string> = {
  '1961': '304 boxes, beads 4/3/2/1, an empty box resigns',
  engine: 'boxes appear as needed, 4 beads each, never resigns',
}

const MOVE_NAMES = ['1st', '2nd', '3rd', '4th']

function Stepper({ label, note, value, min, max, signed, disabled, onChange }: {
  label: string
  note: string
  value: number
  min: number
  max: number
  signed?: boolean
  disabled: boolean
  onChange: (v: number) => void
}) {
  const id = useId()
  return (
    <div className="tstep">
      <div className="tstep__text">
        <span id={id} className="tstep__label">{label}</span>
        <span className="tstep__note">{note}</span>
      </div>
      <div className="tstep__ctl" role="group" aria-labelledby={id}>
        <button className="tstep__btn" aria-label={`Less: ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>-</button>
        <output className="tstep__val" aria-live="polite">{signed && value > 0 ? `+${value}` : value}</output>
        <button className="tstep__btn" aria-label={`More: ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  )
}

export function Tinker({ onClose, onApplied }: { onClose: () => void; onApplied: () => void }) {
  const brain = useGame((s) => s.brain)
  const training = useGame((s) => s.training !== null)
  const games = useGame((s) => gamesPlayed(s.record) + s.trained)
  const [draft, setDraft] = useState<MenaceConfig>(() => brain.config)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')
  const panel = useRef<HTMLElement>(null)
  const keepBtn = useRef<HTMLButtonElement>(null)
  const id = useId()

  // The brain can change under the panel (an import or a wipe): the draft then restarts from the new brain's settings.
  const lastBrain = useRef(brain.config)
  useEffect(() => {
    if (lastBrain.current !== brain.config) {
      lastBrain.current = brain.config
      setDraft(brain.config)
      setConfirming(false)
    }
  }, [brain.config])

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('[role=radio][aria-checked=true]')?.focus()
  }, [])
  useEffect(() => {
    if (confirming) keepBtn.current?.focus()
  }, [confirming])

  // Escape backs out of the confirm first, then closes the panel.
  useEscape(() => {
    if (confirming) setConfirming(false)
    else onClose()
  })

  const engine = draft.rules === 'engine'
  const changed = !sameConfig(draft, brain.config)
  const wipes = !sameShape(draft, brain.config)
  const wordGames = games === 1 ? '1 game' : `${games} games`

  const run = () => {
    const ok = game.getState().applyConfig(draft)
    setConfirming(false)
    if (ok) {
      onApplied()
      setNote(`MENACE: ${game.getState().speech}`)
    } else setNote('Finish the current game or training run first.')
  }
  const apply = () => {
    if (wipes) setConfirming(true)
    else run()
  }

  const pickRules = (rules: RuleSet) => {
    if (rules === draft.rules) return
    setNote('')
    setDraft({ ...defaultConfig(rules), rewards: draft.rewards })
  }
  const reward = (key: RewardKey, v: number) => {
    setNote('')
    setDraft(withReward(draft, key, v))
  }
  const beads = (stage: number, v: number) => {
    setNote('')
    // The engine rules start every box on one number, so its single stepper sets all four stages.
    setDraft(engine ? { ...draft, startBeads: [v, v, v, v] } : withBeads(draft, stage, v))
  }

  return (
    <section ref={panel} className="panel panel--tinker" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="panel__title">Tinker</h2>
      <p className="panel__sub">Change how MENACE plays and learns.</p>

      <Choice<RuleSet> label="Rule set" value={draft.rules} disabled={training} onPick={pickRules}
        options={[{ value: '1961', text: '1961 (Michie)' }, { value: 'engine', text: "Morgan's engine" }]} />
      <ul className="tinker__rules">
        {(['1961', 'engine'] as const).map((r) => (
          <li key={r} className={r === draft.rules ? 'tinker__rule tinker__rule--on' : 'tinker__rule'}>
            <b>{r === '1961' ? '1961' : 'Engine'}:</b> {RULE_NOTES[r]}
          </li>
        ))}
      </ul>

      <h3 className="tinker__h">Rewards</h3>
      <p className="tinker__why">Apply to the memory you have now. Nothing is wiped.</p>
      <Stepper label="Win" note="Beads added to each box MENACE used in a win." value={draft.rewards.win}
        min={LIMITS.win.min} max={LIMITS.win.max} signed disabled={training} onChange={(v) => reward('win', v)} />
      <Stepper label="Draw" note="Beads added to each box used in a draw." value={draft.rewards.draw}
        min={LIMITS.draw.min} max={LIMITS.draw.max} signed disabled={training} onChange={(v) => reward('draw', v)} />
      <Stepper label="Loss" note="Beads taken from each box used in a loss." value={draft.rewards.loss}
        min={LIMITS.loss.min} max={LIMITS.loss.max} signed disabled={training} onChange={(v) => reward('loss', v)} />

      <h3 className="tinker__h">Starting beads</h3>
      <p className="tinker__why">Per square in a fresh box. Changing them wipes the memory.</p>
      {engine ? (
        <Stepper label="Every box" note="Beads on each square when a box is first made, on any move."
          value={draft.startBeads[0]} min={minStartBeads('engine')} max={LIMITS.startBeads.max}
          disabled={training} onChange={(v) => beads(0, v)} />
      ) : (
        MOVE_NAMES.map((name, stage) => (
          <Stepper key={name} label={`${name} move`}
            note={stage === 0 ? 'Boxes MENACE opens first. More beads here, slower learning.' : `Boxes for MENACE's ${name} move.`}
            value={draft.startBeads[stage]} min={LIMITS.startBeads.min} max={LIMITS.startBeads.max}
            disabled={training} onChange={(v) => beads(stage, v)} />
        ))
      )}

      <div className="tinker__actions">
      {confirming ? (
        <div className="tinker__confirm" role="alertdialog" aria-label="Confirm wipe">
          <p>{`This wipes MENACE's memory (${wordGames}).`}</p>
          <div className="panel__row">
            <button ref={keepBtn} className="btn btn--small" onClick={() => setConfirming(false)}>Keep editing</button>
            <button className="btn btn--small btn--primary" onClick={run}>Wipe and apply</button>
          </div>
        </div>
      ) : (
        <div className="panel__row">
          <button className="btn btn--small" onClick={() => { setNote(''); setDraft(defaultConfig(draft.rules)) }}
            disabled={training || sameConfig(draft, defaultConfig(draft.rules))}>Defaults</button>
          <button className="btn btn--small btn--primary" onClick={apply} disabled={training || !changed}>
            {wipes ? 'Apply and wipe' : 'Apply'}
          </button>
          <button className="btn btn--small" onClick={onClose}>Close</button>
        </div>
      )}
      <p className="panel__note" role="status">{note}</p>
      </div>
    </section>
  )
}

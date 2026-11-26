// The "Machine" menu: Reset, Export and Import for MENACE's brain.
// One button in the HUD opens a compact paper panel. Escape or a click outside closes it
// and returns focus to the button. Reset and Import only run between games.
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { EXPORT_FILENAME, MAX_FILE_BYTES, exportBrain, gamesPlayed, parseBrainFile } from '../state/persist'
import { game, useGame } from '../state/store'
import { blockers } from '../state/blockers'
import { tips } from '../state/tips'
import { blocksGameKey } from './panelKeys'
import { useEscape } from './useEscape'
import { SoundToggle } from './SoundToggle'

interface Note {
  kind: 'ok' | 'error'
  text: string
}

function gamesWord(n: number): string {
  return n === 1 ? '1 game' : `${n} games`
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function MachineMenu({ onTinker }: { onTinker: () => void }) {
  const idle = useGame((s) => (s.phase === 'title' || s.phase === 'over') && s.training === null)
  const games = useGame((s) => gamesPlayed(s.record))
  const saveOk = useGame((s) => s.saveOk)
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const resetBtn = useRef<HTMLButtonElement>(null)
  const cancelBtn = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const close = useCallback(() => {
    setOpen(false)
    setConfirming(false)
    setNote(null)
    opener.current?.focus()
  }, [])

  // The open menu switches cabinet picking off. Its outside click closes it on pointerdown, so
  // the block lifts only once that click is over (blockers.ts), and never also picks a box.
  useEffect(() => {
    blockers.set('machine', open)
    return () => blockers.set('machine', false)
  }, [open])

  // Outside clicks, and keeping the game's keys from reaching the game. Capture phase.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (blocksGameKey(e.key)) {
        // The game must not see 1 to 9, Space or Enter while the panel is open. Not
        // preventDefault: a focused panel button still activates.
        e.stopPropagation()
      }
    }
    const onPointer = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (panel.current?.contains(t) || opener.current?.contains(t)) return
      close()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [open, close])

  // Escape closes the menu only; a Train panel or run underneath keeps going.
  useEscape(close, open)

  // Focus moves into the panel on open, and onto the safe choice when the wipe asks to confirm.
  useEffect(() => {
    if (open) panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [open])
  const refocusReset = useRef(false)
  useEffect(() => {
    if (confirming) cancelBtn.current?.focus()
    else if (refocusReset.current) {
      refocusReset.current = false
      resetBtn.current?.focus()
    }
  }, [confirming])

  const onExport = () => {
    const s = game.getState()
    try {
      download(EXPORT_FILENAME, exportBrain(s.brain, s.record))
      setNote({ kind: 'ok', text: `Saved ${EXPORT_FILENAME}.` })
    } catch {
      setNote({ kind: 'error', text: 'The browser would not start the download.' })
    }
  }

  const onWipe = () => {
    const ran = game.getState().resetBrain()
    refocusReset.current = true
    setConfirming(false)
    setNote(ran ? { kind: 'ok', text: `MENACE: ${game.getState().speech}` } : { kind: 'error', text: 'Finish the game first.' })
  }

  const onFile = async (file: File | undefined) => {
    if (file === undefined) return
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('That file is too big to be a MENACE brain.')
      const brain = parseBrainFile(await file.text())
      if (!game.getState().importBrain(brain)) throw new Error('Finish the game first.')
      setNote({ kind: 'ok', text: `MENACE: ${game.getState().speech} Your record is kept.` })
    } catch (err) {
      setNote({ kind: 'error', text: err instanceof Error ? err.message : "That file isn't a MENACE brain." })
    }
  }

  return (
    <div className="machine">
      <button
        ref={opener}
        className="btn btn--small machine__open"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Machine
      </button>
      <SoundToggle />
      {open && (
        <div ref={panel} id={panelId} className="machine__panel" role="dialog" aria-label="The machine">
          <h2 className="machine__title">The machine</h2>
          <p className="machine__sub">
            {gamesWord(games)} on record. {idle ? (saveOk ? 'Saved on this device.' : '') : 'Available between games.'}
          </p>
          {!saveOk && (
            <p className="machine__warn" role="alert">
              Not saved: browser storage is full or blocked.
            </p>
          )}
          {confirming ? (
            <div className="machine__confirm">
              <p>{`Wipe MENACE's memory? It will forget ${games === 1 ? 'its 1 game' : `all ${games} games`}. Your Tinker settings stay.`}</p>
              <div className="machine__row">
                <button ref={cancelBtn} className="btn btn--small" onClick={() => setConfirming(false)}>
                  Keep it
                </button>
                <button className="btn btn--small btn--primary" onClick={onWipe}>
                  Wipe
                </button>
              </div>
            </div>
          ) : (
            <div className="machine__items">
              <button
                className="btn btn--small"
                onClick={() => {
                  close()
                  onTinker()
                }}
                disabled={!idle}
              >
                Tinker
              </button>
              <button className="btn btn--small" onClick={onExport} disabled={!idle}>
                Export brain
              </button>
              <button className="btn btn--small" onClick={() => fileInput.current?.click()} disabled={!idle}>
                Import brain
              </button>
              <button
                className="btn btn--small"
                onClick={() => {
                  tips.getState().showAgain()
                  setNote({ kind: 'ok', text: 'Tips are back for your next game.' })
                }}
                disabled={!idle}
              >
                Show tips again
              </button>
              <button ref={resetBtn} className="btn btn--small" onClick={() => {
                  setNote(null)
                  setConfirming(true)
                }} disabled={!idle}>
                Reset memory
              </button>
            </div>
          )}
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            tabIndex={-1}
            aria-label="Choose a MENACE brain file"
            data-testid="brain-file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void onFile(file)
            }}
          />
          <p className={`machine__note${note ? ` machine__note--${note.kind}` : ''}`} role={note?.kind === 'error' ? 'alert' : 'status'}>
            {note?.text}
          </p>
        </div>
      )}
    </div>
  )
}

// Everything drawn over the canvas. The speech slip is in the scene (Speech.tsx).
import { useCallback, useEffect, useRef, useState } from 'react'
import { blockers } from '../state/blockers'
import { useInspecting } from '../state/inspecting'
import { game, useGame, type Phase } from '../state/store'
import { CurvePanel } from './CurvePanel'
import { GameOver } from './GameOver'
import { HowItWorks } from './HowItWorks'
import { Inspector } from './Inspector'
import { LedgerBar, SpeedControl } from './LedgerBar'
import { MachineMenu } from './MachineMenu'
import { ScoreCard } from './ScoreCard'
import { TurnTip } from './Tips'
import { Title } from './Title'
import { Tinker } from './Tinker'
import { TrainPanel } from './TrainPanel'

export function Hud() {
  const phase = useGame((s) => s.phase)
  const [how, setHow] = useState(false)
  const games = useGame((s) => s.games)
  const inspecting = useInspecting()
  // `at` pins a panel to the gap between games it was opened in; a played game makes it stale.
  const [open, setOpen] = useState<{ which: 'train' | 'curve' | 'tinker'; at: number } | null>(null)
  const between = phase === 'title' || phase === 'over'
  const panel = open !== null && open.at === games && between ? open.which : null
  // Train, Curve and How cover the cabinet: no box can be picked while one is up.
  const covering = panel !== null || how
  useEffect(() => {
    blockers.set('hud', covering)
    return () => blockers.set('hud', false)
  }, [covering])
  const panelOpener = useRef<HTMLElement | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const gameRegion = useRef<HTMLDivElement>(null)
  const lastPhase = useRef<Phase>(phase)

  const openHow = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setHow(true)
  }, [])
  const closeHow = useCallback(() => {
    setHow(false)
    opener.current?.focus()
  }, [])

  const openPanel = useCallback((which: 'train' | 'curve' | 'tinker') => {
    panelOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpen({ which, at: game.getState().games })
  }, [])
  const closePanel = useCallback(() => {
    setOpen(null)
    panelOpener.current?.focus()
  }, [])
  const onTrain = useCallback(() => openPanel('train'), [openPanel])
  const onCurve = useCallback(() => openPanel('curve'), [openPanel])
  const onTinker = useCallback(() => openPanel('tinker'), [openPanel])
  // A wipe resets the game count, so the panel's pin moves with it instead of closing it.
  const onApplied = useCallback(() => setOpen((o) => (o === null ? o : { ...o, at: game.getState().games })), [])

  // Play and Play again unmount the button that was pressed; keep focus inside the game.
  useEffect(() => {
    const was = lastPhase.current
    lastPhase.current = phase
    const started = phase === 'menace' && (was === 'title' || was === 'over')
    if (started && (document.activeElement === null || document.activeElement === document.body)) {
      gameRegion.current?.focus()
    }
  }, [phase])

  return (
    <div className="hud">
      {phase === 'title' && <Title onHow={openHow} onTrain={onTrain} onCurve={onCurve} onTinker={onTinker} hidden={inspecting} />}
      {phase !== 'title' && (
        <div ref={gameRegion} className="game-region" tabIndex={-1} aria-label="Game: press 1 to 9 to play a square">
          <ScoreCard />
          <TurnTip />
          <SpeedControl />
          {phase === 'ledger' && <LedgerBar />}
        </div>
      )}
      {phase === 'over' && <GameOver onTrain={onTrain} onCurve={onCurve} onTinker={onTinker} />}
      {panel === 'train' && <TrainPanel onClose={closePanel} />}
      {panel === 'curve' && <CurvePanel onClose={closePanel} />}
      {panel === 'tinker' && <Tinker onClose={closePanel} onApplied={onApplied} />}
      <Inspector />
      <MachineMenu onTinker={onTinker} />
      {how && <HowItWorks onClose={closeHow} />}
    </div>
  )
}

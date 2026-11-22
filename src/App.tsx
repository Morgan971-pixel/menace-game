import { useEffect } from 'react'
import { Scene } from './scene/Scene'
import { exposeForGate, game } from './state/store'
import { bindTips, tips } from './state/tips'
import { Hud } from './ui/Hud'
import { useTrainDriver } from './ui/useTrainDriver'
import { useLedgerDirector, useLedgerKeys, useNumberKeys, useTurnDirector } from './ui/useTurnDirector'

export default function App() {
  useTurnDirector()
  useTrainDriver()
  useNumberKeys()
  useLedgerDirector()
  useLedgerKeys()
  useEffect(() => exposeForGate(), [])
  useEffect(() => bindTips(tips, game), [])
  return (
    <main className="game">
      <Scene />
      <Hud />
    </main>
  )
}

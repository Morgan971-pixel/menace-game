import { useEffect } from 'react'
import { game, useGame } from '../state/store'

/** Steps a training run one chunk per animation frame, so the page keeps drawing and Stop stays live. */
export function useTrainDriver(): void {
  const running = useGame((s) => s.training !== null)
  useEffect(() => {
    if (!running) return
    let raf = 0
    const tick = () => {
      game.getState().trainStep()
      if (game.getState().training !== null) raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [running])
}

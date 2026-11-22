import { useMemo } from 'react'
import { addLosses, type Dish } from '../state/dish'
import { useGame } from '../state/store'

/**
 * The dish as the scene shows it: counts plus the last 48 squares (the beads drawn). During
 * the ledger it is the dish from before the game plus the boxes already shown, so each flying
 * bead lands in the spot dishSpot(total) the next one takes.
 */
export function useDishBeads(): Dish {
  const dish = useGame((s) => s.dish)
  const before = useGame((s) => s.dishBefore)
  const ledger = useGame((s) => s.ledger)
  const ledgerAt = useGame((s) => s.ledgerAt)
  const live = useGame((s) => s.phase === 'ledger')
  return useMemo(
    () => (live ? addLosses(before, ledger.slice(0, Math.max(0, ledgerAt))) : dish),
    [dish, before, ledger, ledgerAt, live],
  )
}

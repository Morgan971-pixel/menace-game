// What a screen reader hears when a mark goes down: who played where, and the board after.
// Pure: compares two snapshots. Results and ledger boxes have their own live regions
// (GameOver's alert, the ledger caption), and the turn prompt is in Tips, so this covers moves.
import type { Cell } from '../engine/board'

/** "X on 1 and 5. O on 3. Empty: 2, 4, 6, 7, 8, 9." Squares count from 1, top-left. */
export function boardText(board: readonly Cell[]): string {
  const at = (who: Cell) => board.flatMap((c, i) => (c === who ? [i + 1] : []))
  const list = (n: number[]) => (n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`)
  const parts: string[] = []
  const x = at('X')
  const o = at('O')
  const empty = at(null)
  if (x.length > 0) parts.push(`X on ${list(x)}.`)
  if (o.length > 0) parts.push(`O on ${list(o)}.`)
  if (empty.length > 0) parts.push(`Empty: ${empty.join(', ')}.`)
  return parts.join(' ')
}

/** The line to announce for this change, or null when no mark went down. */
export function moveAnnouncement(prev: readonly Cell[], next: readonly Cell[]): string | null {
  const i = next.findIndex((c, k) => c !== null && prev[k] === null)
  if (i < 0) return null
  const who = next[i] === 'X' ? 'MENACE played' : 'You played'
  return `${who} square ${i + 1}. ${boardText(next)}`
}

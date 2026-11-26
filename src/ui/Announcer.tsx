// Screen-reader live region for moves (state/announce.ts). Visually hidden.
import { useEffect, useState } from 'react'
import { moveAnnouncement } from '../state/announce'
import { game } from '../state/store'

export function Announcer() {
  const [text, setText] = useState('')
  useEffect(
    () =>
      game.subscribe((next, prev) => {
        if (next.board === prev.board || next.training !== null) return
        const line = moveAnnouncement(prev.board, next.board)
        if (line !== null) setText(line)
        else if (next.board.every((c) => c === null)) setText('')
      }),
    [],
  )
  return (
    <p className="visually-hidden" aria-live="polite" aria-atomic="true">
      {text}
    </p>
  )
}

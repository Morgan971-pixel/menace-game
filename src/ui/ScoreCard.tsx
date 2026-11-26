import { CHALLENGE_WINS, STREAK_GOAL, useGame } from '../state/store'

export function ScoreCard() {
  const record = useGame((s) => s.record)
  const streak = useGame((s) => s.streak)
  const learned = useGame((s) => s.learned)
  const challenge = useGame((s) => s.challenge !== null)
  // While MENACE is still learning (or in a challenge) the streak counts toward the goal.
  const note = challenge
    ? `Challenge: win ${CHALLENGE_WINS}. Its run ${streak}/${STREAK_GOAL}`
    : learned
      ? `Learned you. Unbeaten ${streak}`
      : streak > 0
        ? `Unbeaten ${streak} of ${STREAK_GOAL}`
        : null
  return (
    <div className={`score${challenge ? ' score--challenge' : ''}`} aria-label={`Record: MENACE ${record.menace}, drawn ${record.draws}, you ${record.you}${note ? `. ${note}` : ''}`}>
      <div className="score__row">
        <div><b>{record.menace}</b>MENACE</div>
        <div><b>{record.draws}</b>Drawn</div>
        <div><b>{record.you}</b>You</div>
      </div>
      {note && <p className="score__note">{note}</p>}
    </div>
  )
}

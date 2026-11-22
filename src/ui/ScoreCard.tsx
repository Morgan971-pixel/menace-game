import { useGame } from '../state/store'

export function ScoreCard() {
  const record = useGame((s) => s.record)
  return (
    <div className="score" aria-label={`Record: MENACE ${record.menace}, drawn ${record.draws}, you ${record.you}`}>
      <div><b>{record.menace}</b>MENACE</div>
      <div><b>{record.draws}</b>Drawn</div>
      <div><b>{record.you}</b>You</div>
    </div>
  )
}

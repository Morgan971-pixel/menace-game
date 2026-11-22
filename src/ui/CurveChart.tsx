// The learning curve as a hand-built SVG: MENACE's win, draw and loss share, stacked to 100%.
// Wins sit at the bottom, so a learning machine's teal band grows up from the floor.
// Every number on screen (the plot, the end labels, the text under it) comes from curveView().
import { useId, useMemo } from 'react'
import { curvePoints, curveView, type Curve, type RunOpponent } from '../state/curve'

const W = 340
const MARGIN = { top: 24, right: 94, bottom: 28, left: 38 }
const RUN_LETTERS: Record<RunOpponent, string> = { random: 'R', perfect: 'P', itself: 'I', player: 'Y', tinker: 'T', learned: 'L' }

interface Props {
  curve: Curve
  /** Drawn height in viewBox units. */
  height?: number
  /** Start the view at the bucket holding game number `from` + 1 (a latest-run view). */
  from?: number
}

/** Moves labels apart so none sit closer than `gap`, keeping their order. */
function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const out = ys.slice()
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + gap)
  const over = out[out.length - 1] - hi
  if (over > 0) for (let i = 0; i < out.length; i++) out[i] -= over
  for (let i = 0; i < out.length; i++) out[i] = Math.max(out[i], lo + i * gap)
  return out
}

export function CurveChart({ curve, height = 190, from = 0 }: Props) {
  const id = useId()
  const view = useMemo(() => curveView(curve, { from }), [curve, from])
  const points = useMemo(() => curvePoints(view.bins), [view])

  const plotW = W - MARGIN.left - MARGIN.right
  const plotH = height - MARGIN.top - MARGIN.bottom
  const y = (share: number) => MARGIN.top + plotH * (1 - share)

  let body
  let markers = ''
  if (points.length < 3 || view.last === null) {
    body = (
      <text x={MARGIN.left + plotW / 2} y={MARGIN.top + plotH / 2} textAnchor="middle" className="chart__empty">
        {view.bins.length === 0 ? 'No games yet.' : 'Too few games for a line.'}
      </text>
    )
  } else {
    const d0 = points[0].x
    const d1 = points[points.length - 1].x
    const x = (game: number) => MARGIN.left + (d1 === d0 ? 0 : ((game - d0) / (d1 - d0)) * plotW)
    const line = (top: (p: (typeof points)[number]) => number) => points.map((p) => `${x(p.x).toFixed(1)},${y(top(p)).toFixed(1)}`)
    const winTop = line((p) => p.win)
    const drawTop = line((p) => p.win + p.draw)
    const rev = (a: string[]) => a.slice().reverse()
    const floor = y(0).toFixed(1)
    const ceil = y(1).toFixed(1)
    const xa = x(d0).toFixed(1)
    const xb = x(d1).toFixed(1)
    const area = (upper: string[], lower: string[] | null) =>
      `M${upper.join('L')}L${lower ? rev(lower).join('L') : `${xb},${floor}L${xa},${floor}`}Z`
    const winPath = area(winTop, null)
    const drawPath = area(drawTop, winTop)
    const lossPath = `M${xa},${ceil}L${xb},${ceil}L${rev(drawTop).join('L')}Z`

    // The end labels are the newest bin, the same numbers as the right edge of the plot.
    const end = view.last
    const mids = [end.win / 2, end.win + end.draw / 2, end.win + end.draw + end.loss / 2]
    const ys = spread(mids.map((m) => y(m) + 5).reverse(), 17, MARGIN.top + 9, MARGIN.top + plotH).reverse()
    const labels = [
      { key: 'won', text: `Won ${Math.round(end.win * 100)}%`, fill: 'var(--teal)' },
      { key: 'drew', text: `Drew ${Math.round(end.draw * 100)}%`, fill: '#6f5f3c' },
      { key: 'lost', text: `Lost ${Math.round(end.loss * 100)}%`, fill: 'var(--brick)' },
    ]
    const ticks = [d0, Math.round((d0 + d1) / 2), d1]

    // A dashed line with the opponent's initial wherever a run began, skipping ones that would crowd.
    const drawn: { x: number; letter: string; key: string }[] = []
    let prevX = -Infinity
    curve.runs.forEach((r, i) => {
      if (r.start < d0 || r.start > d1) return
      const rx = x(r.start)
      if (rx - prevX < 14) return
      prevX = rx
      drawn.push({ x: rx, letter: RUN_LETTERS[r.opponent], key: `${i}-${r.start}` })
    })
    if (drawn.length > 0) markers = 'Dashed lines mark a new opponent: R Random, P Perfect, I Itself, Y you, T new rewards, L it learned you.'

    body = (
      <>
        <path d={winPath} fill="var(--teal)" />
        <path d={drawPath} fill="#c9b48e" />
        <path d={lossPath} fill="var(--brick)" />
        {drawn.map((m) => (
          <g key={m.key} aria-hidden="true">
            <line x1={m.x} x2={m.x} y1={MARGIN.top - 4} y2={MARGIN.top + plotH} stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 4" />
            <line x1={m.x} x2={m.x} y1={MARGIN.top - 4} y2={MARGIN.top + plotH} stroke="#f8f2e2" strokeWidth="2" strokeDasharray="4 4" strokeDashoffset="4" />
            <text x={m.x} y={MARGIN.top - 8} textAnchor="middle" className="chart__run">
              {m.letter}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l.key} x={MARGIN.left + plotW + 6} y={ys[i]} className="chart__label" fill={l.fill}>
            {l.text}
          </text>
        ))}
        {ticks.map((t, i) => (
          <text key={i} x={x(t)} y={height - 7} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} className="chart__tick">
            {t.toLocaleString('en-US')}
          </text>
        ))}
      </>
    )
  }

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-c`} className="chart__svg">
        <title id={`${id}-t`}>Learning curve chart</title>
        <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="#f8f2e2" stroke="var(--ink)" strokeWidth="1.5" />
        {[0, 0.5, 1].map((v) => (
          <text key={v} x={MARGIN.left - 5} y={y(v) + 4} textAnchor="end" className="chart__tick">
            {`${v * 100}%`}
          </text>
        ))}
        {body}
        <text x={W - 4} y={height - 7} textAnchor="end" className="chart__tick" aria-hidden="true">
          games
        </text>
      </svg>
      <figcaption id={`${id}-c`} className="chart__sum">
        {view.bins.length > 0 && <span className="chart__bin">Each point = {view.size.toLocaleString('en-US')} games. </span>}
        {view.summary}
        {markers && <span className="chart__axis"> {markers}</span>}
      </figcaption>
    </figure>
  )
}

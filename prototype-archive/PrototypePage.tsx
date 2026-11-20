// PROTOTYPE: three visual directions on one page, switched with ?variant=A|B|C.
// Throwaway. The winner gets rewritten properly; this file does not ship.
import { useEffect, useState } from 'react'
import { useGame } from './shared/fakeGame'
import { nameA, VariantA } from './VariantA'
import { nameB, VariantB } from './VariantB'
import { nameC, VariantC } from './VariantC'

const VARIANTS = { A: { name: nameA, C: VariantA }, B: { name: nameB, C: VariantB }, C: { name: nameC, C: VariantC } }
type Key = keyof typeof VARIANTS
const KEYS = Object.keys(VARIANTS) as Key[]

function readVariant(): Key {
  const v = new URLSearchParams(location.search).get('variant')?.toUpperCase()
  return v && v in VARIANTS ? (v as Key) : 'A'
}

export function PrototypePage() {
  const [variant, setVariant] = useState<Key>(readVariant)
  const phase = useGame((s) => s.phase)
  const turn = useGame((s) => s.turn)

  const go = (dir: 1 | -1) => {
    const next = KEYS[(KEYS.indexOf(variant) + dir + KEYS.length) % KEYS.length]
    const url = new URL(location.href)
    url.searchParams.set('variant', next)
    history.replaceState(null, '', url)
    setVariant(next)
  }

  // test hook for the visual gate (menace-gate/gate.mjs)
  useEffect(() => {
    const sync = () => {
      const s = useGame.getState()
      ;(window as unknown as { __menace: unknown }).__menace = { variant, phase: s.phase, board: s.board }
    }
    sync()
    return useGame.subscribe(sync)
  }, [variant])

  useEffect(() => {
    const onKey =(e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)) return
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (/^[1-9]$/.test(e.key)) useGame.getState().playerMove(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const V = VARIANTS[variant].C
  return (
    <>
      <V key={variant} />
      {import.meta.env.DEV && (
        <div className="proto-switcher" role="toolbar" aria-label="Prototype variant switcher">
          <button onClick={() => go(-1)} aria-label="Previous variant">‹</button>
          <span className="proto-switcher__label">{variant} ({VARIANTS[variant].name})</span>
          <span className="proto-switcher__state">{phase}{turn ? ` · box ${turn.box + 1}` : ''}</span>
          <button onClick={() => go(1)} aria-label="Next variant">›</button>
        </div>
      )}
    </>
  )
}

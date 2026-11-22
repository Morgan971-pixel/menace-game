import { useId } from 'react'

interface ChoiceProps<T extends string | number> {
  label: string
  value: T
  options: { value: T; text: string }[]
  disabled: boolean
  onPick: (v: T) => void
}

export function Choice<T extends string | number>({ label, value, options, disabled, onPick }: ChoiceProps<T>) {
  const id = useId()
  return (
    <div className="choice">
      <span id={id} className="choice__label">{label}</span>
      <div className="choice__row" role="radiogroup" aria-labelledby={id}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={o.value === value}
            className={`choice__opt${o.value === value ? ' choice__opt--on' : ''}`}
            disabled={disabled}
            tabIndex={o.value === value ? 0 : -1}
            onClick={() => onPick(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value)
              const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
              if (step === 0) return
              e.preventDefault()
              const next = options[(i + step + options.length) % options.length]
              onPick(next.value)
              const group = e.currentTarget.parentElement
              window.requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>('[aria-checked=true]')?.focus())
            }}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}

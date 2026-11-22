import { describe, expect, it } from 'vitest'
import { seeded } from '../engine/rng'
import { createGame } from '../state/store'
import { createEscapeStack } from './escapeStack'

function press(target: EventTarget, key = 'Escape'): Event {
  const e = Object.assign(new Event('keydown', { cancelable: true }), { key })
  target.dispatchEvent(e)
  return e
}

describe('escape stack', () => {
  it('only the topmost layer handles Escape, and popping hands it to the one below', () => {
    const target = new EventTarget()
    const stack = createEscapeStack(target)
    const calls: string[] = []
    const popA = stack.push(() => calls.push('a'))
    const popB = stack.push(() => calls.push('b'))
    press(target)
    expect(calls).toEqual(['b'])
    popB()
    press(target)
    expect(calls).toEqual(['b', 'a'])
    popA()
    press(target)
    expect(calls).toEqual(['b', 'a'])
  })

  it('ignores other keys, and leaves Escape alone when nothing is open', () => {
    const target = new EventTarget()
    const stack = createEscapeStack(target)
    let n = 0
    const pop = stack.push(() => n++)
    press(target, 'Enter')
    press(target, 'a')
    expect(n).toBe(0)
    pop()
    expect(press(target).defaultPrevented).toBe(false)
  })

  it('stops the key reaching other listeners, so a layer underneath never sees it', () => {
    const target = new EventTarget()
    const stack = createEscapeStack(target)
    let other = 0
    stack.push(() => {})
    target.addEventListener('keydown', () => other++)
    const e = press(target)
    expect(e.defaultPrevented).toBe(true)
    expect(other).toBe(0)
  })

  it('popping twice, or out of order, only removes that layer', () => {
    const target = new EventTarget()
    const stack = createEscapeStack(target)
    const calls: string[] = []
    const popA = stack.push(() => calls.push('a'))
    stack.push(() => calls.push('b'))
    popA()
    popA()
    press(target)
    expect(calls).toEqual(['b'])
  })

  it('with the Machine menu open over a training run, one Escape closes only the menu', () => {
    const target = new EventTarget()
    const stack = createEscapeStack(target)
    const g = createGame({ rng: seeded(1), lineRng: seeded(2) })
    g.getState().startTraining('random', 1000)
    // The Train panel mounts first (its Escape stops the run); the Machine menu opens over it.
    stack.push(() => g.getState().stopTraining())
    let menuOpen = true
    const popMenu = stack.push(() => {
      menuOpen = false
      popMenu() // closing the menu unmounts its layer
    })
    press(target)
    expect(menuOpen).toBe(false)
    expect(g.getState().training).not.toBeNull()
    press(target)
    expect(g.getState().training).toBeNull()
  })
})

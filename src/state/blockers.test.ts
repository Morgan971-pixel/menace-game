import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canPick } from './inspector'
import { createBlockers } from './blockers'

describe('canPick', () => {
  it('is false while any panel is open, even between games', () => {
    expect(canPick('title', false, false)).toBe(true)
    expect(canPick('over', false, false)).toBe(true)
    expect(canPick('title', false, true)).toBe(false)
    expect(canPick('over', false, true)).toBe(false)
    expect(canPick('menace', false, false)).toBe(false)
    expect(canPick('over', true, false)).toBe(false)
  })
})

describe('createBlockers', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('blocks while any named source is on', () => {
    const b = createBlockers(new EventTarget())
    expect(b.store.getState().blocked).toBe(false)
    b.set('train', true)
    b.set('machine', true)
    expect(b.store.getState().blocked).toBe(true)
    b.set('train', false)
    expect(b.store.getState().blocked).toBe(true)
    b.set('machine', false)
    expect(b.store.getState().blocked).toBe(false)
  })

  it('clears at once when no pointer is down (a Close button or Escape)', () => {
    const b = createBlockers(new EventTarget())
    b.set('curve', true)
    b.set('curve', false)
    expect(b.store.getState().blocked).toBe(false)
  })

  it('a menu closed by pointerdown stays blocking until that click has finished', () => {
    const target = new EventTarget()
    const b = createBlockers(target)
    b.set('machine', true)
    target.dispatchEvent(new Event('pointerdown'))
    b.set('machine', false) // the menu closes on pointerdown
    expect(b.store.getState().blocked).toBe(true)
    target.dispatchEvent(new Event('pointerup'))
    expect(b.store.getState().blocked).toBe(true) // the click event comes right after pointerup
    vi.advanceTimersByTime(60)
    expect(b.store.getState().blocked).toBe(false)
  })

  it('opening again while a release is pending keeps blocking', () => {
    const target = new EventTarget()
    const b = createBlockers(target)
    b.set('machine', true)
    target.dispatchEvent(new Event('pointerdown'))
    b.set('machine', false)
    b.set('machine', true)
    target.dispatchEvent(new Event('pointerup'))
    vi.advanceTimersByTime(60)
    expect(b.store.getState().blocked).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { blocksGameKey } from './panelKeys'

describe('keys the open Machine panel keeps from the game', () => {
  it('blocks 1 to 9, Space and Enter', () => {
    for (const k of ['1', '5', '9', ' ', 'Enter']) expect(blocksGameKey(k)).toBe(true)
  })
  it('lets everything else through', () => {
    for (const k of ['0', 'a', 'Tab', 'Escape', 'ArrowDown', '10']) expect(blocksGameKey(k)).toBe(false)
  })
})

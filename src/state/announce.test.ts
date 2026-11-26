import { describe, expect, it } from 'vitest'
import { fromString } from '../engine/testing'
import { boardText, moveAnnouncement } from './announce'

describe('announcements', () => {
  it('reads the board with squares numbered 1 to 9 from the top-left', () => {
    expect(boardText(fromString('X.O.X....'))).toBe('X on 1 and 5. O on 3. Empty: 2, 4, 6, 7, 8, 9.')
    expect(boardText(fromString('.........'))).toBe('Empty: 1, 2, 3, 4, 5, 6, 7, 8, 9.')
  })

  it("names who played the new mark and where", () => {
    expect(moveAnnouncement(fromString('.........'), fromString('....X....'))).toMatch(/^MENACE played square 5\. X on 5\./)
    expect(moveAnnouncement(fromString('....X....'), fromString('O...X....'))).toMatch(/^You played square 1\./)
  })

  it('says nothing when no mark went down (or the board was cleared)', () => {
    expect(moveAnnouncement(fromString('....X....'), fromString('....X....'))).toBeNull()
    expect(moveAnnouncement(fromString('X...O....'), fromString('.........'))).toBeNull()
  })
})

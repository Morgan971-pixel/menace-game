// MENACE's typed lines. Dry, competitive, terse, a little smug. Never cruel, never about real people.
// Every spoken line is plain text under about 70 characters with no em dash (lines.test.ts checks).
// Pure: variety comes from a Say, so tests stay deterministic and no line repeats twice in a row.
import type { MenaceConfig } from '../engine/menace'
import type { Rng } from '../engine/rng'

/**
 * Picks one of `options` for a situation. It remembers the last pick per situation and never
 * returns the same option twice in a row (when there is more than one).
 */
export type Say = (situation: string, options: readonly string[]) => string

export function createSay(rng: Rng): Say {
  const last = new Map<string, number>()
  return (situation, options) => {
    if (options.length === 0) throw new Error(`no lines for ${situation}`)
    const prev = last.get(situation)
    const pool = options.map((_, i) => i).filter((i) => i !== prev || options.length === 1)
    const at = pool[Math.floor(rng() * pool.length) % pool.length]
    last.set(situation, at)
    return options[at]
  }
}

/** 1,204 not 1204. */
export const fmt = (n: number): string => n.toLocaleString('en-US')

/** Whole-number percentage, never 0 for a square that holds beads. */
export function percent(share: number): number {
  if (share <= 0) return 0
  return Math.max(1, Math.round(share * 100))
}

export type Confidence = 'sure' | 'mid' | 'unsure'
/** Over 60% of the beads on the square: sure. Under 25%: unsure. */
export function confidence(share: number): Confidence {
  return share > 0.6 ? 'sure' : share < 0.25 ? 'unsure' : 'mid'
}

export const THINK: Record<Confidence, readonly ((box: number, pct: number) => string)[]> = {
  sure: [
    (b, p) => `Box ${b}. ${p}% of the beads agree. So do I.`,
    (b, p) => `Box ${b}. I know this one. ${p}% sure.`,
    (b, p) => `Box ${b}. ${p}% on one square. Easy.`,
    (b, p) => `Box ${b}. The beads decided: ${p}%.`,
    (b, p) => `Box ${b}. ${p}%. I have seen this before.`,
  ],
  mid: [
    (b, p) => `Box ${b}. ${p}% for this square. Good enough.`,
    (b, p) => `Box ${b}. A ${p}% hunch. Shaking.`,
    (b, p) => `Box ${b}. ${p}% says I know what I am doing.`,
    (b, p) => `Box ${b}. ${p}%. Not a lock, but I like it.`,
  ],
  unsure: [
    (b, p) => `Box ${b}. Only ${p}% for this one. Bear with me.`,
    (b, p) => `Box ${b}. The beads are split. ${p}% will do.`,
    (b, p) => `Box ${b}. Still learning this one. ${p}%.`,
    (b, p) => `Box ${b}. ${p}% sure. I am guessing, politely.`,
  ],
}

export function thinkLine(say: Say, box: number, sure: number): string {
  const bucket = confidence(sure)
  const pct = percent(sure)
  return say(`think:${bucket}`, THINK[bucket].map((f) => f(box, pct)))
}

export function forcedLine(say: Say): string {
  return say('forced', [
    'One square left. No box needed.',
    'Last square. Even I cannot get this wrong.',
    'Move five. The board decides for me.',
    'Only one door open. I take it.',
    'No choice here, so no bead.',
  ])
}

export function resignLine(say: Say, box: number): string {
  return say('resign', [
    `Box ${box} is empty. Nothing left to try. I resign.`,
    `Box ${box}: no beads. You taught me that. I resign.`,
    `Box ${box} is bare. You win this one.`,
    `I resign. Box ${box} has nothing left to say.`,
    `Box ${box} ran out of ideas. I resign.`,
  ])
}

export function endLine(say: Say, result: 'X' | 'O' | 'D', boxesUsed: number): string {
  const boxes = boxesUsed === 1 ? 'the box' : `all ${boxesUsed} boxes`
  if (result === 'X') {
    return say('end:win', [
      `I win. Three beads into ${boxes}. Thank you.`,
      'As the beads foretold.',
      'Mine. Those moves will come up more often now.',
      'Three in a row. Write that down.',
    ])
  }
  if (result === 'O') {
    return say('end:loss', [
      `You win. A bead leaves ${boxes}.`,
      'Noted. Those beads are confiscated.',
      'A loss. I will play that less often.',
      'Well played. It will not work twice.',
    ])
  }
  return say('end:draw', [
    `A draw. One bead back into ${boxes}.`,
    'Stalemate. I am learning your habits.',
    'A draw. I will take it, and a bead.',
    'Nobody wins. I call that progress.',
  ])
}

export function openingLine(say: Say): string {
  return say('opening', ['Let me find the right box.', 'New game. I go first.', 'Pulling a box.', 'My move first. Always.'])
}

/** The very first game: a fresh machine, every box as Michie filled it. */
export function firstGameLine(say: Say): string {
  return say('first', [
    'First game. I know nothing yet. Neither do my beads.',
    'A newcomer. My boxes are full of guesses. I start.',
    'New machine, new opponent. I go first.',
    'I have 304 boxes and no memory. Let us fix that.',
  ])
}

/** The first game after the page was loaded with games already on record. */
export function returningLine(say: Say, games: number): string {
  const all = games === 1 ? 'our one game' : `all ${fmt(games)} games`
  return say('returning', [
    `Back for more. I remember ${all}.`,
    `You again. I remember ${all}.`,
    `Welcome back. My boxes kept ${all}.`,
    `Ready when you are. I kept ${all}.`,
  ])
}

const beads = (n: number) => `${n} ${n === 1 ? 'bead' : 'beads'}`

/** The three how-it-works steps, with the numbers of the machine the player actually has. */
export function howSteps(config: MenaceConfig) {
  const start = config.startBeads[0]
  const { win, draw, loss } = config.rewards
  const gain = (n: number) => (n === 0 ? 'nothing changes' : `every box it used gains ${beads(n)} of the colour it drew`)
  const lose =
    loss === 0 ? 'nothing is removed'
    : loss === -1 ? 'the drawn bead is removed'
    : `${beads(-loss)} of the colour it drew are removed`
  const floor = config.rules === 'engine' ? ' A colour never drops below 1 bead, so MENACE never runs dry.' : ''
  return [
    {
      title: 'Shake',
      body:
        'MENACE finds the matchbox for the board in front of it and shakes it. ' +
        `Box 1, the empty board, starts with ${start} ${start === 1 ? 'bead' : 'beads'} per square: ${start * 9} in all.`,
    },
    {
      title: 'Draw',
      body: 'It pulls out one bead at random. The bead\'s colour is the square it plays, so more beads of a colour make that move likelier.',
    },
    {
      title: 'Reward',
      body: `Win: ${gain(win)}. Draw: ${draw === 0 ? 'nothing changes' : beads(draw)}. Loss: ${lose}.${floor}`,
    },
  ] as const
}

/** The one line about boxes: 304 under the 1961 rules, up to 338 under the engine's. */
export function howSymmetry(config: MenaceConfig): string {
  return config.rules === '1961'
    ? 'Positions that are mirror images or rotations of each other share one box, which is how 304 boxes cover every game.'
    : 'Positions that are mirror images or rotations of each other share one box. There are up to 338 boxes, made as each new position comes up.'
}

/** Bead colour per real square, matching BEAD_COLORS in the scene. */
export const BEAD_NAMES = ['red', 'gold', 'green', 'teal', 'blue', 'purple', 'pink', 'white', 'black'] as const

/** What the ledger needs to know about one box. */
export interface LedgerFacts {
  kind: 'reward' | 'resign'
  slot: number
  square: number | null
  delta: number
}

/** "Box 12: +3 red (square 7)". The resign box: "Box 57: empty. I resigned." */
export function ledgerLine(item: LedgerFacts): string {
  const box = `Box ${item.slot + 1}`
  if (item.kind === 'resign' || item.square === null) return `${box}: empty. I resigned.`
  const sign = item.delta > 0 ? '+' : item.delta < 0 ? '-' : '+'
  return `${box}: ${sign}${Math.abs(item.delta)} ${BEAD_NAMES[item.square]} (square ${item.square + 1})`
}

export interface LedgerSummary {
  result: 'X' | 'O' | 'D'
  /** Boxes that learned (the resign box is not one of them). */
  boxes: number
  /** Beads added or confiscated in total. */
  beads: number
  /** Box number of the empty box when MENACE resigned, else null. */
  resignBox: number | null
}

const beadsWord = (n: number) => (n === 1 ? '1 bead' : `${fmt(n)} beads`)
const boxesWord = (n: number) => (n === 1 ? '1 box' : `${fmt(n)} boxes`)

export interface LedgerSummary {
  result: 'X' | 'O' | 'D'
  /** Boxes that learned (the resign box is not one of them). */
  boxes: number
  /** Beads added or confiscated in total. */
  beads: number
  /** Box number of the empty box when MENACE resigned, else null. */
  resignBox: number | null
}

/** MENACE's dry, competitive last word once the ledger is closed. */
export function summaryLine(say: Say, s: LedgerSummary): string {
  if (s.resignBox !== null) {
    return say('summary:resign', [
      `Box ${s.resignBox} stays empty. I will steer around it.`,
      `Ledger closed. Box ${s.resignBox} is out of ideas, I am not.`,
      `Box ${s.resignBox} is bare now. Other boxes will cover.`,
      `I resigned once. Box ${s.resignBox} will not do it twice.`,
    ])
  }
  if (s.result === 'X') {
    return say('summary:win', [
      `Ledger closed: ${beadsWord(s.beads)} richer. Again?`,
      `${beadsWord(s.beads)} banked. Those moves just got louder.`,
      `Booked, +${fmt(s.beads)}. You are making me better at this.`,
      `${boxesWord(s.boxes)} paid out. I like this arithmetic.`,
    ])
  }
  if (s.result === 'D') {
    return say('summary:draw', [
      `A draw still pays: +${fmt(s.beads)}. I am in no hurry.`,
      `Ledger closed, ${beadsWord(s.beads)} up. Draws add up.`,
      `+${fmt(s.beads)} for a draw. Next time I want the board.`,
      `${boxesWord(s.boxes)} nudged. Slow work, steady work.`,
    ])
  }
  return say('summary:loss', [
    `${beadsWord(s.beads)} confiscated. I will not walk into that again.`,
    `Ledger closed: minus ${fmt(s.beads)}. Enjoy it while it lasts.`,
    `Noted in ${boxesWord(s.boxes)}. That trick has a short shelf life.`,
    `${boxesWord(s.boxes)} docked. I keep receipts.`,
  ])
}

/** After a reset: a fresh machine, every bead back where Michie put it. */
export function resetLine(say: Say): string {
  return say('reset', [
    'Memory wiped. Every box is back to its starting beads.',
    'Reset. I remember nothing. Convenient for you.',
    'Clean slate. Start thinking of new tricks.',
    'All forgotten. Start thinking of new tricks.',
  ])
}

/** After Tinker switches the rule set (the machine starts again from nothing). */
export function rulesLine(say: Say, rules: '1961' | 'engine'): string {
  if (rules === '1961') {
    return say('rules:1961', [
      'Back to 1961 rules. 304 boxes, and I can resign.',
      'Michie rules again. An empty box means I give up.',
      'Rebuilt as in 1961. Every box ready, none to spare.',
      'Old rules, old matchboxes. Try not to get nostalgic.',
    ])
  }
  return say('rules:engine', [
    "Morgan's engine now. Boxes appear when I need them.",
    'New rules: I never resign. You may regret that.',
    'Engine rules. Four beads a square, and no giving up.',
    'Switched to the engine. Fewer boxes, no surrender.',
  ])
}

/** After Tinker changes the rewards (the memory is kept). */
export function rewardsLine(say: Say): string {
  return say('rewards', [
    'New rewards noted. I will learn at the new rate.',
    'Rewards changed. My memory stays, my motives shift.',
    'Different prizes. I am still keeping count.',
    'Fine, new stakes. I learn from the next game on.',
  ])
}

/** After an import. `boxes` is the number of matchboxes in the brain that arrived. */
export function importLine(say: Say, boxes: number): string {
  return say('import', [
    `Memory received. ${fmt(boxes)} boxes, restored as they were.`,
    `${fmt(boxes)} boxes restored. I recall everything.`,
    `Brain restored: ${fmt(boxes)} boxes. Where were we?`,
    `Old habits restored, all ${fmt(boxes)} boxes of them.`,
  ])
}

/** Said once if the browser will not keep the save. */
export function saveFailedLine(): string {
  return 'Not saved: browser storage is full or blocked. I will forget this when you leave.'
}

/** What a training run counted, from MENACE's side. */
export interface TrainFacts {
  total: number
  done: number
  won: number
  drawn: number
  lost: number
}

/** When a run begins. */
export function trainStartLine(say: Say, opponent: string, games: number): string {
  const n = games === 1 ? '1 game' : `${fmt(games)} games`
  return say('train:start', [
    `${n} against ${opponent}. Do not wait up.`,
    `Training: ${n} against ${opponent}. Back in a moment.`,
    `${n} against ${opponent}. I will be unbearable after.`,
    `${n} against ${opponent}. Practice is cheap.`,
  ])
}

/**
 * MENACE's dry summary once a run ends or is stopped. These carry the counts, so they run
 * longer than the spoken lines (the Train panel has the room).
 */
export function trainLine(say: Say, opponent: string, t: TrainFacts, stopped: boolean): string {
  const games = t.done === 1 ? '1 game' : `${fmt(t.done)} games`
  const head = stopped ? `Stopped after ${fmt(t.done)} of ${fmt(t.total)} games against ${opponent}.` : `${games} against ${opponent}.`
  if (t.done === 0) return head
  const won = t.won === 0 ? 'Won none' : `Won ${fmt(t.won)}`
  const drew = t.drawn === 0 ? 'drew none' : `drew ${fmt(t.drawn)}`
  if (t.lost === 0) {
    return `${head} ${say('train:clean', ['Lost none.', 'Not one loss.', 'Unbeaten.', 'Spotless.'])} ${won}, ${drew}.`
  }
  const rough = t.lost * 2 > t.done
  const tail = rough
    ? say('train:rough', ['Noted.', 'The beads will sort it out.', 'Tuition paid.', 'I will study the tape.'])
    : say('train:fine', ['I will take it.', 'The boxes remember.', 'Good practice.', 'Getting sharper.'])
  return `${head} ${won}, ${drew}, lost ${fmt(t.lost)}. ${tail}`
}

/** The first time MENACE goes ten games without losing to the player. */
export function milestoneLine(say: Say): string {
  return say('milestone', [
    'Ten games without a loss. I have learned you.',
    'Ten unbeaten. My boxes know your habits now.',
    'That makes ten without losing. Write it down.',
    'Ten in a row. The beads have your number.',
    'Ten games, no losses. You are well studied.',
  ])
}

/** The player ended MENACE's unbeaten run (said when the run was long enough to notice). */
export function streakBrokenLine(say: Say): string {
  return say('broken', [
    'You found a hole. I will patch it.',
    'Streak over. Those beads are coming out.',
    'Well spotted. That gap will not stay open.',
    'My run ends. Your trick goes on the record.',
    'A loss at last. I will study how.',
  ])
}

/** A challenge begins against a fresh machine. */
export function challengeStartLine(say: Say): string {
  return say('challenge:start', [
    'A fresh machine. I know nothing, and neither do you.',
    'Clean boxes, clean slate. Win before I lock you out.',
    'New me, no memory. Make it count.',
    'Challenge accepted. My old boxes are shut away.',
  ])
}

/** The player beat the fresh machine. */
export function challengeWonLine(say: Say): string {
  return say('challenge:won', [
    'You beat the fresh one. It had no memory to defend with.',
    'Beaten. A newborn is easy prey. Try the real one.',
    'Fine, you win. I had empty boxes and big dreams.',
    'The newborn lost. Come back and face the one that remembers.',
  ])
}

/** The fresh machine reached ten unbeaten: the player is locked out. */
export function challengeLostLine(say: Say): string {
  return say('challenge:lost', [
    'Ten without losing. The door is locked.',
    'Locked out. A fresh machine learned you in ten.',
    'Ten unbeaten. That was quick, even for me.',
    'No win from you in ten. Challenge over.',
  ])
}

/** The player closes a challenge and the real machine returns. */
export function challengeEndLine(say: Say): string {
  return say('challenge:end', [
    'Back to my real memory. Nothing was touched.',
    'Challenge closed. My real boxes were never opened.',
    'The old me is back, with every bead where you left it.',
    'Real machine restored. The fresh one is forgotten.',
  ])
}

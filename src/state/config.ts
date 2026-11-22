// The settings Tinker may change, and the one place their limits live.
// persist.ts uses isAllowedConfig to vet any brain from outside (a save or an imported file),
// the Tinker panel uses the same ranges for its steppers, and the store refuses anything else.
import { defaultConfig, type MenaceConfig, type RuleSet } from '../engine/menace'

export const RULE_SETS: readonly RuleSet[] = ['1961', 'engine']

/** Inclusive ranges. Small on purpose: nothing a player can set may reach a size that hurts. */
export const LIMITS = {
  startBeads: { min: 0, max: 20 },
  win: { min: 0, max: 10 },
  draw: { min: 0, max: 10 },
  loss: { min: -10, max: 0 },
} as const

/**
 * Lowest start beads per rule set. The engine rules floor a box at 1, so a box that starts on 0
 * would jump to 1 on its first loss: a loss would add a bead. 1961 allows 0 (an empty box resigns).
 */
export const minStartBeads = (rules: RuleSet): number => (rules === 'engine' ? 1 : LIMITS.startBeads.min)

export type RewardKey = 'win' | 'draw' | 'loss'

const inRange = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max

/** Why a config is not allowed, or null when it is. Never throws, whatever it is given. */
export function configProblem(c: unknown): string | null {
  if (typeof c !== 'object' || c === null) return 'the settings are missing.'
  const { rules, startBeads, rewards } = c as Partial<MenaceConfig>
  if (rules !== '1961' && rules !== 'engine') return `unknown rule set "${String(rules)}".`
  if (!Array.isArray(startBeads) || startBeads.length !== 4) return 'starting beads must be four numbers.'
  const lo = minStartBeads(rules)
  const hi = LIMITS.startBeads.max
  if (!startBeads.every((n) => inRange(n, lo, hi))) {
    return `starting beads must be whole numbers from ${lo} to ${hi}.`
  }
  // The engine rules read one number for every box, so a file with four different ones is not one the game made.
  if (rules === 'engine' && !startBeads.every((n) => n === startBeads[0])) {
    return 'under the engine rules all four starting beads must be equal.'
  }
  if (typeof rewards !== 'object' || rewards === null) return 'the rewards are missing.'
  for (const key of ['win', 'draw', 'loss'] as const) {
    const { min, max } = LIMITS[key]
    if (!inRange(rewards[key], min, max)) return `the ${key} reward must be a whole number from ${min} to ${max}.`
  }
  return null
}

export function isAllowedConfig(c: unknown): c is MenaceConfig {
  return configProblem(c) === null
}

/** Same rule set and starting beads: only rewards differ, so the current brain can keep going. */
export function sameShape(a: MenaceConfig, b: MenaceConfig): boolean {
  return a.rules === b.rules && a.startBeads.every((n, i) => n === b.startBeads[i])
}

export function sameConfig(a: MenaceConfig, b: MenaceConfig): boolean {
  return (
    sameShape(a, b) &&
    a.rewards.win === b.rewards.win &&
    a.rewards.draw === b.rewards.draw &&
    a.rewards.loss === b.rewards.loss
  )
}

export function isDefaultConfig(c: MenaceConfig): boolean {
  return sameConfig(c, defaultConfig(c.rules))
}

export function withBeads(c: MenaceConfig, stage: number, value: number): MenaceConfig {
  const startBeads = [...c.startBeads] as unknown as MenaceConfig['startBeads'] & number[]
  startBeads[stage] = value
  return { ...c, startBeads }
}

export function withReward(c: MenaceConfig, key: RewardKey, value: number): MenaceConfig {
  return { ...c, rewards: { ...c.rewards, [key]: value } }
}

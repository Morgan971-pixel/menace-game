/** Keys the game listens for (1 to 9 place O, Space and Enter skip the ledger). The open Machine panel swallows them. */
export function blocksGameKey(key: string): boolean {
  return /^[1-9]$/.test(key) || key === ' ' || key === 'Enter'
}

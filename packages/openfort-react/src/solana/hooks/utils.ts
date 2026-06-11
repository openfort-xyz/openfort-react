const LAMPORTS_PER_SOL = BigInt(1_000_000_000)

export function formatSol(lamports: bigint, decimals = 4): string {
  const whole = lamports / LAMPORTS_PER_SOL
  const remainder = lamports % LAMPORTS_PER_SOL
  const fracStr = remainder.toString().padStart(9, '0')
  return `${whole}.${fracStr}`.replace(new RegExp(`(\\d*\\.\\d{${decimals}})\\d*`), '$1')
}

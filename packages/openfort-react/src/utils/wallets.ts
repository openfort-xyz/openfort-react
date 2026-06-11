/** EIP-1193 provider injected by wallets (MetaMask, etc.); may have providers array when multiple injected */
type EthereumWindowProvider = Record<string, unknown> & {
  providers?: Record<string, unknown>[]
}

declare global {
  interface Window {
    trustWallet: any
    trustwallet: any
    ethereum?: EthereumWindowProvider
  }
}

const isWalletInstalled = (name: string) => {
  if (typeof window === 'undefined') return false
  const { ethereum } = window
  return !!(ethereum?.[`is${name}`] || ethereum?.providers?.find((provider) => provider?.[`is${name}`]))
}

export const isFamily = () => isWalletInstalled('Family')
export const isPhantom = () => isWalletInstalled('Phantom')
export const isArgent = () => isWalletInstalled('Argent')
export const isSafe = () => isWalletInstalled('Safe')

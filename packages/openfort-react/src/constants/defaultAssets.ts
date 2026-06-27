import type { Hex } from 'viem'

/** A default token surfaced when no custom assets are configured. */
type DefaultAsset = { symbol: string; name: string; decimals: number; address: Hex }

/**
 * Default ERC-20 assets per chain id, mirroring the set returned by
 * `wallet_getAssets` — see https://www.openfort.io/docs/configuration/default-assets.
 * Used to surface common tokens (USDC / USDT / DAI / wrapped native) in the asset
 * inventory even at zero balance. Native tokens come from `getNativeCurrency`.
 */
export const DEFAULT_ASSETS: Record<number, DefaultAsset[]> = {
  // Ethereum Mainnet
  1: [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
  ],
  // Optimism
  10: [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, address: '0x4200000000000000000000000000000000000006' },
  ],
  // BSC
  56: [
    { symbol: 'USDC', name: 'USD Coin', decimals: 18, address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
    { symbol: 'USDT', name: 'Tether USD', decimals: 18, address: '0x55d398326f99059fF775485246999027B3197955' },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3' },
    { symbol: 'WBNB', name: 'Wrapped BNB', decimals: 18, address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' },
  ],
  // Polygon
  137: [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' },
    { symbol: 'WMATIC', name: 'Wrapped Matic', decimals: 18, address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' },
  ],
  // Base
  8453: [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, address: '0x4200000000000000000000000000000000000006' },
  ],
  // Arbitrum
  42161: [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18, address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
    { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' },
  ],
  // Avalanche
  43114: [
    { symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' },
    { symbol: 'USDT', name: 'Tether USD', decimals: 6, address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7' },
    { symbol: 'DAI.e', name: 'Dai Stablecoin', decimals: 18, address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70' },
    { symbol: 'WETH.e', name: 'Wrapped Ether', decimals: 18, address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB' },
  ],
  // Sepolia
  11155111: [{ symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' }],
  // Amoy
  80002: [{ symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' }],
  // Base Sepolia
  84532: [{ symbol: 'USDC', name: 'USD Coin', decimals: 6, address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' }],
}

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'DAI.E'])

/** Whether a symbol is a ~$1 stablecoin (for the inventory's USD estimate). */
export function isStableSymbol(symbol: string): boolean {
  return STABLE_SYMBOLS.has(symbol.toUpperCase())
}

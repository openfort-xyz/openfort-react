/**
 * Mobile "open-dApp" wallet deeplinks (the Daimo pattern).
 *
 * Each wallet exposes a universal link that opens an arbitrary https URL inside
 * its own in-app dApp browser. We point every one at the standalone deposit
 * "send" page ({@link buildDepositPageUrl}) carrying the deposit address, chain,
 * token and amount as query params. The user taps their wallet, the page opens
 * with `window.ethereum` injected, and confirms the transfer there.
 *
 * The page URL is configured by the integrator via `uiConfig.funding.depositPageUrl`
 * (the deployed `deposit.html`). Without it, no deeplinks are produced.
 */

type WalletDeeplink = { app: string; label: string; url: string }

export type VmType = 'evm' | 'svm'

/**
 * Default hosted deposit "send" page (Openfort-operated). Used when the
 * integrator doesn't set `uiConfig.funding.depositPageUrl`, so one-tap mobile
 * wallet deeplinks work out of the box.
 */
export const OPENFORT_DEPOSIT_PAGE_URL = 'https://deposit.openfort.io'

type DepositPageParams = {
  /** Source VM family. `evm` drives a window.ethereum send; `svm` a Solana Pay request. */
  vm: VmType
  /** Relay deposit address the source funds go to (0x for EVM, base58 for Solana). */
  to: string
  /** Numeric source chain id (e.g. 42161). EVM only. */
  chainId?: number
  /** ERC-20 contract / SPL mint, or empty/undefined for the chain's native token. */
  token?: string
  decimals: number
  symbol: string
  /** Human-readable chain name shown on the page. */
  chain?: string
  /** Optional preset amount in base units (uint256 string). */
  amount?: string
}

/** Build the deposit "send" page URL with the transfer params encoded. */
export function buildDepositPageUrl(baseUrl: string, p: DepositPageParams): string {
  const url = new URL(baseUrl)
  url.searchParams.set('vm', p.vm)
  url.searchParams.set('to', p.to)
  if (p.vm === 'evm' && p.chainId !== undefined) url.searchParams.set('chainId', String(p.chainId))
  if (p.token) url.searchParams.set('token', p.token)
  url.searchParams.set('decimals', String(p.decimals))
  url.searchParams.set('symbol', p.symbol)
  if (p.chain) url.searchParams.set('chain', p.chain)
  if (p.amount) url.searchParams.set('amount', p.amount)
  return url.toString()
}

/** "eip155:8453" -> 8453 (undefined if not a numeric CAIP-2 reference). */
export function caipToChainId(caip2?: string): number | undefined {
  if (!caip2) return undefined
  const n = Number(caip2.split(':')[1])
  return Number.isFinite(n) ? n : undefined
}

const stripScheme = (u: string): string => u.replace(/^https?:\/\//, '')
const enc = encodeURIComponent
const originOf = (u: string): string => {
  try {
    return new URL(u).origin
  } catch {
    return ''
  }
}

type WalletApp = {
  app: string
  label: string
  /** Chains this wallet handles. Phantom is multichain (EVM + Solana). */
  vms: VmType[]
  build: (pageUrl: string) => string
}

// Open-dApp universal links. Each format verified (2026) against the wallet's
// docs/source plus a second independent source. `pageUrl` is the deposit send
// page; most want it URL-encoded, MetaMask wants the https:// scheme stripped.
const WALLETS: WalletApp[] = [
  {
    app: 'metamask',
    label: 'Open MetaMask',
    vms: ['evm'],
    build: (u) => `https://link.metamask.io/dapp/${stripScheme(u)}`,
  },
  {
    app: 'coinbase',
    label: 'Open Coinbase Wallet',
    vms: ['evm'],
    build: (u) => `https://go.cb-w.com/dapp?cb_url=${enc(u)}`,
  },
  {
    app: 'trust',
    label: 'Open Trust Wallet',
    vms: ['evm'],
    // coin_id=60 = Ethereum (SLIP-44). In-app dApp browser is Android-only;
    // iOS shows "Deep Link not Supported" (Apple removed it in 2021).
    build: (u) => `https://link.trustwallet.com/open_url?coin_id=60&url=${enc(u)}`,
  },
  {
    app: 'rainbow',
    label: 'Open Rainbow',
    vms: ['evm'],
    build: (u) => `https://rainbow.me/dapp?url=${enc(u)}`,
  },
  {
    app: 'rabby',
    label: 'Open Rabby',
    vms: ['evm'],
    build: (u) => `https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${enc(u)}`,
  },
  {
    app: 'phantom',
    label: 'Open Phantom',
    vms: ['evm', 'svm'],
    build: (u) => `https://phantom.app/ul/browse/${enc(u)}?ref=${enc(originOf(u))}`,
  },
]

/**
 * Open-dApp deeplinks for every wallet matching `vmType`, each wrapping the
 * deposit send page so it loads in that wallet's in-app browser.
 */
export function buildOpenDappLinks(pageUrl: string, vmType: VmType): WalletDeeplink[] {
  return WALLETS.filter((w) => w.vms.includes(vmType)).map((w) => ({
    app: w.app,
    label: w.label,
    url: w.build(pageUrl),
  }))
}

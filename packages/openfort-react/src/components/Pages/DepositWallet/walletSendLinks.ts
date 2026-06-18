import type { WalletDeeplink } from '../../../hooks/openfort/useFunding'

/**
 * Prefilled-send deeplinks into the user's source wallet app (the Daimo pattern).
 *
 * The backend leaves `PaymentMethod.deeplinks` empty in the MVP (no hosted page),
 * so we synthesise the per-app links client-side from the session's EIP-681 /
 * Solana Pay address URI (`pm.addressUri`) — every input is already known here.
 *
 * Prefill support varies by wallet: MetaMask documents a `/send/` deeplink that
 * wraps the EIP-681 payload; the others register the `ethereum:` / `solana:`
 * scheme and open their send flow straight from the raw URI. The receiver
 * address always prefills; amount/token encoding is best-effort per app.
 */

type Vm = 'evm' | 'svm'

type WalletApp = {
  /** Matches the logo keys in DepositWallet's WALLET_LOGO map. */
  app: string
  label: string
  vm: Vm
  /** Builds the deeplink from `pm.addressUri` (e.g. "ethereum:0x…@8453?value=1000000"). */
  build: (uri: string) => string
}

const WALLETS: WalletApp[] = [
  {
    app: 'metamask',
    label: 'MetaMask',
    vm: 'evm',
    // MetaMask's documented send deeplink takes the EIP-681 body (scheme stripped).
    build: (uri) => `https://metamask.app.link/send/${uri.replace(/^ethereum:/, '')}`,
  },
  { app: 'trust', label: 'Trust Wallet', vm: 'evm', build: (uri) => uri },
  { app: 'rainbow', label: 'Rainbow', vm: 'evm', build: (uri) => uri },
  { app: 'rabby', label: 'Rabby', vm: 'evm', build: (uri) => uri },
  { app: 'coinbase', label: 'Coinbase Wallet', vm: 'evm', build: (uri) => uri },
  { app: 'phantom', label: 'Phantom', vm: 'svm', build: (uri) => uri },
]

/**
 * Build the source-wallet deeplink list for a deposit route.
 *
 * @param addressUri - The session's `pm.addressUri` (EIP-681 / Solana Pay), or undefined before a session exists.
 * @param vmType - The source chain VM family ("evm" | "svm"); gates which wallet apps apply.
 * @returns One {@link WalletDeeplink} per applicable app, or `[]` when no session/URI yet.
 */
export function buildWalletSendLinks(addressUri: string | undefined, vmType: string): WalletDeeplink[] {
  if (!addressUri) return []
  const vm: Vm = vmType === 'svm' ? 'svm' : 'evm'
  return WALLETS.filter((w) => w.vm === vm).map((w) => ({ app: w.app, label: w.label, url: w.build(addressUri) }))
}

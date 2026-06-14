/**
 * @packageDocumentation
 *
 * ## SSR Compatibility
 *
 * **All hooks and interactive components are client-only.** They use React hooks and browser APIs
 * and must run in Client Components.
 *
 * - **Server Components (Next.js App Router, Remix):** Do not use hooks or `OpenfortProvider` in
 *   Server Components. Wrap your app (or the subtree that needs Openfort) in a Client Component.
 * - **Next.js App Router:** Add `"use client"` at the top of any file that imports hooks,
 *   `OpenfortProvider`, or `OpenfortButton`.
 * - **Hydration:** No hydration mismatches when used correctly. Keep the provider and any
 *   hook-using components on the client boundary.
 *
 * @example
 * ```tsx
 * // app/providers.tsx
 * "use client"
 * import { OpenfortProvider } from "@openfort/react"
 *
 * export function Providers({ children }) {
 *   return <OpenfortProvider publishableKey="pk_...">{children}</OpenfortProvider>
 * }
 * ```
 *
 * ## Provider setup
 *
 * **Ethereum + wagmi (external wallets, SIWE):** the providers must be nested in this exact
 * order — getting it wrong silently disables embedded-wallet sync (a runtime failure, not a
 * type error):
 *
 * ```tsx
 * <QueryClientProvider client={queryClient}>
 *   <WagmiProvider config={wagmiConfig}>
 *     <OpenfortWagmiBridge>            // from "@openfort/react/wagmi"
 *       <OpenfortProvider publishableKey="pk_..." walletConfig={{ shieldPublishableKey: "..." }}>
 *         {children}
 *       </OpenfortProvider>
 *     </OpenfortWagmiBridge>
 *   </WagmiProvider>
 * </QueryClientProvider>
 * ```
 *
 * **Headless / SDK-only (Solana, or EVM without wagmi):** no wagmi, no bridge — just wrap with
 * `QueryClientProvider` (only if you use TanStack Query) and `OpenfortProvider`. The connect
 * modal is lazy-loaded, so a headless app that never opens it does not pay for the UI at runtime.
 *
 * ## Which hook should I use?
 *
 * | Need | Use |
 * |------|-----|
 * | Auth user (isAuthenticated, user, linkedAccounts) | `useUser()` |
 * | Am I connected? (auth + wallet ready) | `useUser().isConnected` |
 * | EVM wallet (address, chainId, status, create, export) | `useEthereumEmbeddedWallet()` from `@openfort/react/ethereum` |
 * | Solana wallet (address, cluster, status, create) | `useSolanaEmbeddedWallet()` from `@openfort/react/solana` |
 * | Native token balance | `useEthereumBalance()` (EVM) · `useBalance({ chainType, address })` (any chain) |
 * | Token + NFT inventory (EVM) | `useEthereumWalletAssets()` from `@openfort/react/ethereum` |
 * | Send ETH / write contract (EVM) | `useSendTransaction()` / `useWriteContract()` from `@openfort/react/ethereum` (no wagmi needed; or use `wagmi`) |
 * | Sign message / send SOL (Solana) | Use `@solana/kit` with the embedded wallet provider |
 * | Connect/link wallet (SIWE) + list wallets | `useWalletAuth()` / `useConnectWithSiwe()` (from `@openfort/react/wagmi`) |
 * | Scoped store subscription (avoid whole-store re-renders) | `useOpenfortStore(selector)` |
 * | Grant session key permissions | `useGrantPermissions()` |
 * | Revoke session key permissions | `useRevokePermissions()` |
 */
// ── SDK re-exports ──────────────────────────────────────────────────────────
export {
  AccountTypeEnum,
  AuthInitPayload,
  AuthResponse,
  ChainTypeEnum,
  EmbeddedAccount,
  OpenfortEventMap,
  OpenfortEvents,
  openfortEvents,
  RecoveryMethod,
  RecoveryParams,
  SignedMessagePayload,
  User,
} from '@openfort/openfort-js'
export type { CountrySelectorProps } from 'react-international-phone'
// ── Provider + UI components ─────────────────────────────────────────────────
export { default as Avatar } from './components/Common/Avatar'
export { default as ChainIcon } from './components/Common/Chain'
export { OpenfortButton } from './components/ConnectButton'
export { OpenfortProvider } from './components/Openfort/OpenfortProvider'
export type { CustomizableRoutes, MultiChainAsset } from './components/Openfort/types'
export { LinkWalletOnSignUpOption, UIAuthProvider as AuthProvider } from './components/Openfort/types'
export { embeddedWalletId } from './constants/openfort'
export {
  OpenfortError,
  OpenfortReactErrorType,
  OpenfortReactErrorType as OpenfortErrorType,
} from './core/errors'
export type {
  ConnectedEmbeddedEthereumWallet,
  EthereumWalletState,
  SetActiveEthereumWalletOptions,
  UseEmbeddedEthereumWalletOptions,
} from './ethereum/types'
export { useAuthCallback } from './hooks/openfort/auth/useAuthCallback'
export type { EmailVerificationResult } from './hooks/openfort/auth/useEmailAuth'
export { useEmailAuth } from './hooks/openfort/auth/useEmailAuth'
export { useEmailOtpAuth } from './hooks/openfort/auth/useEmailOtpAuth'
export { useGuestAuth } from './hooks/openfort/auth/useGuestAuth'
export type { StoreCredentialsResult } from './hooks/openfort/auth/useOAuth'
export { useOAuth } from './hooks/openfort/auth/useOAuth'
export { usePhoneOtpAuth } from './hooks/openfort/auth/usePhoneOtpAuth'
export { useSignOut } from './hooks/openfort/auth/useSignOut'
export {
  type SignAuthorizationParameters,
  type SignAuthorizationReturnType,
  use7702Authorization,
} from './hooks/openfort/use7702Authorization'
export { useGrantPermissions } from './hooks/openfort/useGrantPermissions'
export { useRevokePermissions } from './hooks/openfort/useRevokePermissions'
export { useUI } from './hooks/openfort/useUI'
export { useUser } from './hooks/openfort/useUser'
export type { UserWallet } from './hooks/openfort/walletTypes'
export type { BalanceState, UseBalanceOptions } from './hooks/useBalance'
export { invalidateBalance, useBalance } from './hooks/useBalance'
export { StoreContext } from './openfort/context'
// ── Store / selectors ────────────────────────────────────────────────────────
export {
  selectActiveAddress,
  selectChainType,
  selectEmbeddedState,
  selectIsAuthenticated,
  selectIsLoading,
  selectUser,
  selectWalletStatus,
} from './openfort/selectors'
export type { OpenfortStore, OpenfortStoreState } from './openfort/store'
export { useOpenfortCore as useOpenfort, useOpenfortCore } from './openfort/useOpenfort'
export { useOpenfortStore } from './openfort/useOpenfortStore'
export { getEmbeddedAccountsQueryOptions, getUserQueryOptions, openfortKeys } from './query'
export type {
  CreateEmbeddedWalletOptions,
  CreateEmbeddedWalletResult,
  SetRecoveryOptions,
} from './shared/types'
// ── Utilities ────────────────────────────────────────────────────────────────
export { createSIWEMessage } from './siwe/create-siwe-message'
export type {
  ConnectedEmbeddedSolanaWallet,
  SetActiveSolanaWalletOptions,
  SolanaConfig,
  SolanaWalletState,
  UseEmbeddedSolanaWalletOptions,
} from './solana/types'
export type { CustomTheme } from './styles/customTheme'
export type {
  CustomAvatarProps,
  Languages,
  Mode,
  OpenfortErrorOptions,
  OpenfortHookOptions,
  OpenfortOptions,
  OpenfortWalletConfig,
  PhoneConfig,
  Theme,
} from './types'
export { createOpenfortError, ERROR_CODES, OAuthProvider, SDKOverrides, ThirdPartyOAuthProvider } from './types'
export { formatAddress } from './utils/format'
export { getDefaultSolanaRpcUrl } from './utils/rpc'
export { OPENFORT_VERSION } from './version'

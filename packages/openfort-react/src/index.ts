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
 * ## Which hook should I use?
 *
 * | Need | Use |
 * |------|-----|
 * | Auth user (isAuthenticated, user, linkedAccounts) | `useUser()` |
 * | Am I connected? (auth + wallet ready) | `useUser().isConnected` |
 * | EVM wallet (address, chainId, status, create, export) | `useEthereumEmbeddedWallet()` from `@openfort/react/ethereum` |
 * | Solana wallet (address, cluster, status, create) | `useSolanaEmbeddedWallet()` from `@openfort/react/solana` |
 * | Send ETH / write contract / get balance (EVM) | Use `wagmi` or `viem` directly |
 * | Get SOL balance / sign message / send SOL (Solana) | Use `@solana/kit` with embedded wallet provider |
 * | Connect/link wallet (SIWE) + list wallets | `useWalletAuth()` (from `@openfort/react/wagmi`) |
 * | Grant session key permissions | `useGrantPermissions()` |
 * | Revoke session key permissions | `useRevokePermissions()` |
 */
// ── SDK re-exports ──────────────────────────────────────────────────────────
export type {
  AuthInitPayload,
  AuthResponse,
  EmbeddedAccount,
  OpenfortEventMap,
  RecoveryParams,
  SignedMessagePayload,
  User,
} from '@openfort/openfort-js'
export {
  AccountTypeEnum,
  ChainTypeEnum,
  OpenfortEvents,
  openfortEvents,
  RecoveryMethod,
} from '@openfort/openfort-js'
export type { CountrySelectorProps } from 'react-international-phone'
// ── Provider + UI components ─────────────────────────────────────────────────
export { default as Avatar } from './components/Common/Avatar/index.js'
export { default as ChainIcon } from './components/Common/Chain/index.js'
export { OpenfortButton } from './components/ConnectButton/index.js'
export { OpenfortProvider } from './components/Openfort/OpenfortProvider.js'
export type {
  ConnectUIOptions as OpenfortOptions,
  CustomizableRoutes,
  MultiChainAsset,
  OpenfortWalletConfig,
  PhoneConfig,
  SignTypedDataPayload,
} from './components/Openfort/types.js'
export { FundingMethod, LinkWalletOnSignUpOption, UIAuthProvider as AuthProvider } from './components/Openfort/types.js'
export { embeddedWalletId } from './constants/openfort.js'
export {
  ApiRequestError,
  type ApiRequestErrorType,
  AuthenticationError,
  type AuthenticationErrorType,
  ChainNotConfiguredError,
  type ChainNotConfiguredErrorType,
  ClientNotInitializedError,
  type ClientNotInitializedErrorType,
  ConnectorNotFoundError,
  type ConnectorNotFoundErrorType,
  ConnectorTypeMismatchError,
  type ConnectorTypeMismatchErrorType,
  type ErrorType,
  FundingError,
  type FundingErrorType,
  FundingNotConfiguredError,
  type FundingNotConfiguredErrorType,
  InvalidEmailError,
  type InvalidEmailErrorType,
  MissingParameterError,
  type MissingParameterErrorType,
  NotAuthenticatedError,
  type NotAuthenticatedErrorType,
  OpenfortConfigError,
  type OpenfortConfigErrorType,
  OpenfortError,
  type OpenfortErrorOptions,
  /**
   * @deprecated Narrow on `error.name` (or `instanceof`) instead. The concrete
   * error classes carry far more information than these five buckets; the enum
   * stays populated on every instance's `type` field and is removed in the next major.
   */
  OpenfortReactErrorType,
  /**
   * @deprecated Narrow on `error.name` (or `instanceof`) instead. Removed in the next major.
   */
  OpenfortReactErrorType as OpenfortErrorType,
  OtpRequiredError,
  type OtpRequiredErrorType,
  ProviderNotFoundError,
  type ProviderNotFoundErrorType,
  ProviderNotReadyError,
  type ProviderNotReadyErrorType,
  RecoveryError,
  type RecoveryErrorType,
  RpcUrlNotConfiguredError,
  type RpcUrlNotConfiguredErrorType,
  SetActiveWalletError,
  type SetActiveWalletErrorType,
  SiweMessageError,
  type SiweMessageErrorType,
  SolanaClusterNotSupportedError,
  type SolanaClusterNotSupportedErrorType,
  UnsupportedOperationError,
  type UnsupportedOperationErrorType,
  ValidationError,
  type ValidationErrorType,
  type WalletChain,
  WalletConfigNotFoundError,
  type WalletConfigNotFoundErrorType,
  WalletCreationError,
  type WalletCreationErrorType,
  WalletError,
  type WalletErrorType,
  WalletImportError,
  type WalletImportErrorType,
  WalletNotConnectedError,
  type WalletNotConnectedErrorType,
  WalletNotFoundError,
  type WalletNotFoundErrorType,
} from './errors/index.js'
export type {
  ConnectedEmbeddedEthereumWallet,
  EthereumWalletState,
  SetActiveEthereumWalletOptions,
  UseEmbeddedEthereumWalletOptions,
} from './ethereum/types.js'
export { useAuthCallback } from './hooks/openfort/auth/useAuthCallback.js'
export type { EmailVerificationResult } from './hooks/openfort/auth/useEmailAuth.js'
export { useEmailAuth } from './hooks/openfort/auth/useEmailAuth.js'
export { useEmailOtpAuth } from './hooks/openfort/auth/useEmailOtpAuth.js'
export { useGuestAuth } from './hooks/openfort/auth/useGuestAuth.js'
export type { StoreCredentialsResult } from './hooks/openfort/auth/useOAuth.js'
export { useOAuth } from './hooks/openfort/auth/useOAuth.js'
export { usePhoneOtpAuth } from './hooks/openfort/auth/usePhoneOtpAuth.js'
export { useSignOut } from './hooks/openfort/auth/useSignOut.js'
export type {
  FundingClient,
  FundingSession,
  FundingTarget,
  PaymentMethod,
  PaymentMethodInput,
} from './hooks/openfort/fundingClient.js'
export {
  type SignAuthorizationParameters,
  type SignAuthorizationReturnType,
  use7702Authorization,
} from './hooks/openfort/use7702Authorization.js'
export type { UseFunding, UseFundingOptions } from './hooks/openfort/useFunding.js'
export { useFunding } from './hooks/openfort/useFunding.js'
export { useGrantPermissions } from './hooks/openfort/useGrantPermissions.js'
export { useRevokePermissions } from './hooks/openfort/useRevokePermissions.js'
export { useSignMessage } from './hooks/openfort/useSignMessage.js'
export { useUI } from './hooks/openfort/useUI.js'
export { useUser } from './hooks/openfort/useUser.js'
export type { UserWallet } from './hooks/openfort/walletTypes.js'
export { useInvalidateBalance } from './hooks/useBalance.js'
// ── Store internals (moved to `@openfort/react/internal`) ────────────────────
export type {
  /** @deprecated import from `@openfort/react/internal` instead */
  OpenfortStore,
  /** @deprecated import from `@openfort/react/internal` instead */
  OpenfortStoreState,
} from './internal/index.js'
export {
  /** @deprecated import from `@openfort/react/internal` instead */
  StoreContext,
  /** @deprecated import from `@openfort/react/internal` instead */
  selectActiveAddress,
  /** @deprecated import from `@openfort/react/internal` instead */
  selectChainType,
  /** @deprecated import from `@openfort/react/internal` instead */
  selectEmbeddedState,
  /** @deprecated import from `@openfort/react/internal` instead */
  selectIsAuthenticated,
  /** @deprecated import from `@openfort/react/internal` instead */
  selectIsLoading,
  /** @deprecated import from `@openfort/react/internal` instead */
  selectUser,
  /** @deprecated import from `@openfort/react/internal` instead */
  selectWalletStatus,
} from './internal/index.js'
export {
  useOpenfortCore as useOpenfort,
  /** @deprecated use `useOpenfort` instead */
  useOpenfortCore,
} from './openfort/useOpenfort.js'
export { getEmbeddedAccountsQueryOptions, getUserQueryOptions, openfortKeys } from './query/index.js'
export type {
  CreateEmbeddedWalletOptions,
  CreateEmbeddedWalletResult,
  SetRecoveryOptions,
} from './shared/types.js'
// ── Utilities ────────────────────────────────────────────────────────────────
export { createSIWEMessage } from './siwe/create-siwe-message.js'
export type {
  ConnectedEmbeddedSolanaWallet,
  SetActiveSolanaWalletOptions,
  SolanaConfig,
  SolanaWalletState,
  UseEmbeddedSolanaWalletOptions,
} from './solana/types.js'
export type { CustomTheme } from './styles/customTheme.js'
export type {
  CustomAvatarProps,
  Languages,
  Mode,
  OpenfortHookOptions,
  SDKOverrides,
  Theme,
} from './types.js'
export { OAuthProvider, ThirdPartyOAuthProvider } from './types.js'
export { formatAddress } from './utils/format.js'
export { getDefaultSolanaRpcUrl } from './utils/rpc.js'
export { OPENFORT_VERSION } from './version.js'

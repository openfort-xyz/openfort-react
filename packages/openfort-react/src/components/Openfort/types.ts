import type { ChainTypeEnum, RecoveryMethod } from '@openfort/openfort-js'
import type React from 'react'
import type { ReactNode } from 'react'
import type { CountryData, CountryIso2, CountrySelectorProps } from 'react-international-phone'
import type { Hex } from 'viem'
import type { getAssets } from 'viem/experimental/erc7811'
import type { EthereumConfig } from '../../ethereum/types'
import type { EthereumUserWallet, SolanaUserWallet } from '../../hooks/openfort/walletTypes'
import type { SolanaConfig } from '../../solana/types'

import type { CustomAvatarProps, CustomTheme, Languages, Mode, Theme } from '../../types'

export const routes = {
  PROVIDERS: 'providers',
  SOCIAL_PROVIDERS: 'socialProviders',
  PROFILE: 'profile',
  EXPORT_KEY: 'exportKey',

  LOADING: 'loading',
  LOAD_WALLETS: 'loadWallets',
  RECOVER_WALLET: 'recoverWallets',
  SELECT_WALLET_TO_RECOVER: 'selectWalletToRecover',
  CREATE_WALLET: 'createWallet',
  CONNECTED_SUCCESS: 'connectedSuccess',

  CREATE_GUEST_USER: 'createGuestUser',
  EMAIL_LOGIN: 'emailLogin',
  EMAIL_OTP: 'emailOtp',
  PHONE_OTP: 'phoneOtp',
  FORGOT_PASSWORD: 'forgotPassword',
  EMAIL_VERIFICATION: 'emailVerification',
  LINK_EMAIL: 'linkEmail',

  ONBOARDING: 'onboarding',
  ABOUT: 'about',

  CONNECTORS: 'connectors',
  MOBILECONNECTORS: 'mobileConnectors',
  CONNECT_WITH_MOBILE: 'connectWithMobile',

  CONNECT: 'connect',
  DOWNLOAD: 'download',
  CONNECTED: 'connected',
  SWITCHNETWORKS: 'switchNetworks',
  LINKED_PROVIDER: 'linkedProvider',
  LINKED_PROVIDERS: 'linkedProviders',
  REMOVE_LINKED_PROVIDER: 'removeLinkedProvider',

  NO_ASSETS_AVAILABLE: 'noAssetsAvailable',
  ASSET_INVENTORY: 'assetInventory',

  SEND: 'send',
  SEND_TOKEN_SELECT: 'sendTokenSelect',
  SEND_CONFIRMATION: 'sendConfirmation',
  RECEIVE: 'receive',
  DEPOSIT: 'deposit',
  DEPOSIT_CRYPTO: 'depositCrypto',
  DEPOSIT_WALLET: 'depositWallet',
  DEPOSIT_CEX: 'depositCex',
  BUY: 'buy',
  BUY_TOKEN_SELECT: 'buyTokenSelect',
  BUY_SELECT_PROVIDER: 'buySelectProvider',
  BUY_PROCESSING: 'buyProcessing',
  BUY_COMPLETE: 'buyComplete',
  BUY_PROVIDER_SELECT: 'buyProviderSelect',

  ETH_CONNECTED: 'eth:connected',
  ETH_CREATE_WALLET: 'eth:createWallet',
  ETH_RECOVER_WALLET: 'eth:recoverWallet',
  ETH_SWITCH_NETWORK: 'eth:switchNetworks',
  ETH_SEND: 'eth:send',
  ETH_RECEIVE: 'eth:receive',
  ETH_BUY: 'eth:buy',
  ETH_CONNECTORS: 'eth:connectors',

  SOL_CONNECTED: 'sol:connected',
  SOL_CREATE_WALLET: 'sol:createWallet',
  SOL_RECOVER_WALLET: 'sol:recoverWallet',
  SOL_SEND: 'sol:send',
  SOL_SEND_CONFIRMATION: 'sol:sendConfirmation',
  SOL_RECEIVE: 'sol:receive',
  SOL_ASSET_INVENTORY: 'sol:assetInventory',
  SOL_WALLETS: 'sol:wallets',

  WALLET_OVERVIEW: 'walletOverview',
} as const

type AllRoutes = (typeof routes)[keyof typeof routes]

export const notStoredInHistoryRoutes: AllRoutes[] = [
  routes.LOADING,
  routes.CONNECTED_SUCCESS,
  routes.ONBOARDING,
  routes.ABOUT,
  routes.LOAD_WALLETS,
  routes.CREATE_GUEST_USER,
]

type ConnectOptions =
  | {
      connectType: 'link' | 'connect' | 'linkIfUserConnectIfNoUser'
    }
  | {
      connectType: 'recover'
      wallet: EthereumUserWallet | SolanaUserWallet
    }

export type LinkedAccount = {
  provider: string
  accountId?: string
  chainId?: number | string
  walletClientType?: string
}

type RoutesWithOptions =
  | ({ route: typeof routes.CONNECTORS } & ConnectOptions)
  | ({ route: typeof routes.CONNECT } & ConnectOptions)
  | { route: typeof routes.RECOVER_WALLET; wallet: EthereumUserWallet }
  | { route: typeof routes.SOL_RECOVER_WALLET; wallet: SolanaUserWallet }
  | { route: typeof routes.LINKED_PROVIDER; account: LinkedAccount }
  | { route: typeof routes.REMOVE_LINKED_PROVIDER; account: LinkedAccount }

export type RoutesWithoutOptions = {
  route: Exclude<AllRoutes, RoutesWithOptions['route']>
}

// RouteOptions can be either routes without options or routes with options (both objects)
export type RouteOptions = RoutesWithoutOptions | RoutesWithOptions

// SetRouteOptions can be either a RouteOptions object or just the route string for routes without options
export type SetRouteOptions = RouteOptions | RoutesWithoutOptions['route']

export enum UIAuthProvider {
  GOOGLE = 'google',
  TWITTER = 'twitter',
  X = 'twitter',
  FACEBOOK = 'facebook',

  DISCORD = 'discord',
  // EPIC_GAMES = "epic_games",
  // LINE = "line",
  // TELEGRAM = "telegram", // Telegram is not working yet
  APPLE = 'apple',

  // Extended Providers
  EMAIL_PASSWORD = 'emailPassword',
  EMAIL_OTP = 'emailOtp',
  PHONE = 'phone',
  WALLET = 'wallet',
  GUEST = 'guest',
}

export const socialProviders = [
  UIAuthProvider.GOOGLE,
  UIAuthProvider.TWITTER,
  UIAuthProvider.FACEBOOK,
  UIAuthProvider.DISCORD,
  UIAuthProvider.APPLE,
]

export enum LinkWalletOnSignUpOption {
  OPTIONAL = 'optional',
  REQUIRED = 'required',
  DISABLED = 'disabled',
}

type CommonWalletConfig = {
  /** Publishable key for the Shield API. */
  shieldPublishableKey: string
  /**
   * Whether to automatically recover or create an embedded wallet after authentication.
   *
   * - `true` (default): recover an existing wallet and create a new one if none exists.
   * - `false`: do nothing after auth — call `wallet.create()` / `wallet.setActive()` explicitly.
   *
   * @defaultValue true
   */
  connectOnLogin?: boolean
  /**
   * The display name shown next to the passkey credential in the browser's passkey dialog
   * (e.g. "My Wallet" or "Trading Account"). Defaults to "Openfort - Embedded Wallet".
   */
  passkeyDisplayName?: string
}

type GetEncryptionSessionParams = {
  accessToken: string
  otpCode?: string
  userId: string
}

type EncryptionSession =
  | {
      /** Function to retrieve an encryption session using a session ID. */
      getEncryptionSession?: ({ accessToken, otpCode, userId }: GetEncryptionSessionParams) => Promise<string>
      createEncryptedSessionEndpoint?: never
    }
  | {
      /** API endpoint for creating an encrypted session. */
      getEncryptionSession?: never
      createEncryptedSessionEndpoint?: string
    }

type RecoverWithOTP =
  | {
      /** Function to recover a wallet with otp. */
      requestWalletRecoverOTP?: ({
        accessToken,
        userId,
        email,
        phone,
      }: {
        accessToken: string
        userId: string
        email?: string
        phone?: string
      }) => Promise<void>
      requestWalletRecoverOTPEndpoint?: never
    }
  | {
      /** API endpoint for recovering a wallet with otp. */
      requestWalletRecoverOTP?: never
      requestWalletRecoverOTPEndpoint?: string
    }

export type DebugModeOptions = {
  openfortReactDebugMode?: boolean
  openfortCoreDebugMode?: boolean
  shieldDebugMode?: boolean
  debugRoutes?: boolean
}

/**
 * Configuration for wallet recovery behaviour.
 *
 * @remarks
 * Automatic recovery requires an encryption session, which may be supplied via
 * the `createEncryptedSessionEndpoint` endpoint or the `getEncryptionSession` callback.
 * Password-based and passkey-based recovery methods do not require encryption sessions.
 */
export type OpenfortWalletConfig = CommonWalletConfig &
  EncryptionSession &
  RecoverWithOTP & {
    /** Which chain type to activate on first mount. Defaults to EVM. */
    chainType?: ChainTypeEnum
    ethereum?: EthereumConfig
    solana?: SolanaConfig
  }

type OpenfortUIOptions = {
  linkWalletOnSignUp?: LinkWalletOnSignUpOption

  authProviders: UIAuthProvider[]
  authProvidersLength?: number

  skipEmailVerification?: boolean
  termsOfServiceUrl?: string
  privacyPolicyUrl?: string
  logo?: React.ReactNode
}

type WalletRecoveryOptions = {
  allowedMethods?: RecoveryMethod[]
  defaultMethod?: RecoveryMethod
}

export type PhoneConfig = {
  /**
   * @description Default country value (iso2).
   * @default "us"
   */
  defaultCountry?: CountryIso2
  /**
   * @description Array of available countries for guessing.
   * @default defaultCountries // full country list
   */
  countries?: CountryData[]
  /**
   * @description Countries to display at the top of the list of dropdown options.
   * @default []
   */
  preferredCountries?: CountryIso2[]
  /**
   * @description Disable country guess on value change.
   * @default false
   */
  disableCountryGuess?: boolean
  /**
   * @description
   * Disable dial code prefill on initialization.
   * Dial code prefill works only when "empty" phone value have been provided.
   * @default false
   */
  disableDialCodePrefill?: boolean
  /**
   * @description
   * Always display the dial code.
   * Dial code can't be removed/changed by keyboard events, but it can be changed by pasting another country phone value.
   * @default false
   */
  forceDialCode?: boolean
  /**
   * @description Display phone value will not include passed *dialCode* and *prefix* if set to *true*.
   * @ignore *forceDialCode* value will be ignored.
   * @default false
   */
  disableDialCodeAndPrefix?: boolean
  /**
   * @description Disable phone value mask formatting. All formatting characters will not be displayed, but the mask length will be preserved.
   * @default false
   */
  disableFormatting?: boolean
  /**
   * @description Hide the dropdown icon. Make country selection not accessible.
   * @default false
   */
  hideDropdown?: CountrySelectorProps['hideDropdown']
  /**
   * @description
   * Show prefix and dial code between country selector and phone input.
   * Works only when *disableDialCodeAndPrefix* is *true*
   * @default false
   */
  showDisabledDialCodeAndPrefix?: boolean
  /**
   * @description Disable auto focus on input field after country select.
   * @default false
   */
  disableFocusAfterCountrySelect?: boolean
}

export type ConnectUIOptions = {
  /** App name (e.g. for WalletConnect og:title). When using getDefaultConfig from @openfort/react/wagmi, pass the same appName here for consistency. */
  appName?: string
  theme?: Theme
  mode?: Mode
  customTheme?: CustomTheme
  hideBalance?: boolean
  hideTooltips?: boolean
  hideRecentBadge?: boolean
  walletConnectCTA?: 'link' | 'modal' | 'both'
  /** Avoids layout shift when the Openfort modal is open by adding padding to the body. */
  avoidLayoutShift?: boolean
  /** Automatically embeds the Google font of the current theme. Does not work with custom themes. */
  embedGoogleFonts?: boolean
  truncateLongENSAddress?: boolean
  walletConnectName?: string
  reducedMotion?: boolean
  disclaimer?: ReactNode | string
  /** Buffer polyfill, needed for bundlers that do not provide Node polyfills (e.g. CRA, Vite, etc.). */
  bufferPolyfill?: boolean
  customAvatar?: React.FC<CustomAvatarProps>
  enforceSupportedChains?: boolean
  /** Blur intensity applied to the background when the modal is open. */
  overlayBlur?: number
  walletRecovery?: WalletRecoveryOptions
  buyWithCardUrl?: string
  buyFromExchangeUrl?: string
  buyTroubleshootingUrl?: string
  /**
   * Base URL of the funding JSON API serving `/v2/funding/*` (e.g.
   * `https://api.openfort.io`). Powers the Deposit hub's crypto/CEX rails (chains +
   * session API). When omitted, those rails are unavailable and the network layer
   * is a no-op.
   *
   * TODO(openfort-funding-backend): default this from the platform config so
   * integrators don't have to set it manually.
   */
  fundingBaseUrl?: string
  /** Deposit-hub funding options (destination chain/token for incoming deposits). */
  funding?: FundingUIOptions
  phoneConfig?: PhoneConfig
  customPageComponents?: {
    [key in CustomizableRoutes]?: React.ReactElement
  }
} & Partial<OpenfortUIOptions>

type WalletRecoveryOptionsExtended = {
  allowedMethods: RecoveryMethod[]
  defaultMethod: RecoveryMethod
}

/**
 * A funding method shown in the Deposit hub. Use `funding.methods` to choose
 * which appear and in what order — like `authProviders` for the auth modal.
 */
export enum FundingMethod {
  /** Apple Pay (fiat onramp; mobile only). */
  APPLE_PAY = 'applePay',
  /** Card (fiat onramp). */
  CARD = 'card',
  /** Transfer from wallet — prefilled wallet deeplinks. */
  WALLET = 'wallet',
  /** Transfer from address — cross-chain deposit address + QR. */
  ADDRESS = 'crypto',
  /** Transfer from Exchange — Coinbase / Binance on-ramp links + deposit address. */
  EXCHANGE = 'cex',
}

/** Where Deposit-hub funding lands. Defaults to USDC on Base when omitted. */
export type FundingUIOptions = {
  /**
   * Destination CAIP-2 chain id for deposits.
   * @default "eip155:8453" (Base)
   */
  targetChain?: string
  /**
   * Destination token contract on the target chain (or the zero address for native).
   * @default USDC on Base
   */
  targetCurrency?: string
  /**
   * Which funding methods the Deposit hub shows, and in what order. Omit to show
   * all available methods (Apple Pay first on mobile). Mirrors `authProviders`.
   * @example [FundingMethod.WALLET, FundingMethod.ADDRESS]
   */
  methods?: FundingMethod[]
  /**
   * Allowlist of source chains shown in the crypto/exchange pickers, by CAIP-2 id,
   * in this order. Omit for the common defaults (Arbitrum, Base, BNB, Ethereum,
   * Monad, Optimism, Polygon, Solana). Selections the rail doesn't support are
   * skipped.
   * @example ['eip155:8453', 'eip155:42161', 'eip155:137']
   */
  sourceChains?: string[]
  /**
   * Allowlist of source currencies shown, by symbol (case-insensitive). The
   * sentinel `'native'` matches each chain's native currency (ETH, SOL, POL, …).
   * Applied across every chain; chains left with none are hidden. Omit for the
   * default `['native', 'USDC', 'USDT']`.
   * @example ['native', 'USDC', 'USDT']
   */
  sourceCurrencies?: string[]
  /**
   * URL of the standalone deposit "send" page. On mobile, wallet open-dApp
   * deeplinks wrap this URL with the deposit address, chain, token and amount so
   * the user confirms the transfer in their wallet's in-app browser. Defaults to
   * the Openfort-hosted page (`https://deposit.openfort.io`); override to self-host,
   * or set to an empty string to hide one-tap wallet deeplinks (the deposit-address
   * / QR path still works).
   * @default "https://deposit.openfort.io"
   * @example "https://yourapp.com/deposit.html"
   */
  depositPageUrl?: string
}

export type CustomizableRoutes = typeof routes.CONNECTED

export type OpenfortUIOptionsExtended = {
  appName?: string
  theme: Theme
  mode: Mode
  customTheme?: CustomTheme
  language?: Languages
  hideBalance?: boolean
  hideTooltips?: boolean
  hideQuestionMarkCTA?: boolean
  hideNoWalletCTA?: boolean
  hideRecentBadge?: boolean
  walletConnectCTA?: 'link' | 'modal' | 'both'
  /** Avoids layout shift when the Openfort modal is open by adding padding to the body. */
  avoidLayoutShift?: boolean
  /** Automatically embeds the Google font of the current theme. Does not work with custom themes. */
  embedGoogleFonts?: boolean
  truncateLongENSAddress?: boolean
  walletConnectName?: string
  reducedMotion?: boolean
  disclaimer?: ReactNode | string
  /** Buffer polyfill, needed for bundlers that do not provide Node polyfills (e.g. CRA, Vite, etc.). */
  bufferPolyfill?: boolean
  customAvatar?: React.FC<CustomAvatarProps>
  enforceSupportedChains?: boolean
  ethereumOnboardingUrl?: string
  walletOnboardingUrl?: string
  /** Disable redirect to the SIWE page after a wallet is connected. */
  disableSiweRedirect?: boolean
  /** Blur intensity applied to the background when the modal is open. */
  overlayBlur?: number
  buyWithCardUrl?: string
  buyFromExchangeUrl?: string
  buyTroubleshootingUrl?: string
  /** Base URL of the openfort-funding backend. See {@link ConnectUIOptions.fundingBaseUrl}. */
  fundingBaseUrl?: string
  /** Deposit-hub funding options. See {@link ConnectUIOptions.funding}. */
  funding?: FundingUIOptions
  walletRecovery: WalletRecoveryOptionsExtended
  phoneConfig?: PhoneConfig
  customPageComponents?: {
    [key in CustomizableRoutes]?: React.ReactElement
  }
} & OpenfortUIOptions

export type Asset =
  | {
      type: 'native'
      address?: 'native'
      balance: bigint
      metadata?: {
        decimals?: number
        symbol: string
        name?: never
        fiat: {
          value: number
          currency: string
        }
      }
      raw?: getAssets.NativeAsset
    }
  | {
      type: 'erc20'
      address: Hex
      balance: bigint
      metadata: {
        decimals?: number
        symbol: string
        name: string
        fiat?: {
          value: number
          currency: string
        }
      }
      raw?: getAssets.Erc20Asset
    }

export type MultiChainAsset = Asset & { chainId: number }

export type SendFormState = {
  recipient: string
  amount: string
  asset: Asset
}

export const defaultSendFormState: SendFormState = {
  recipient: '',
  amount: '',
  asset: {
    type: 'native',
    balance: BigInt(0),
  },
}

export type BuyProviderId = 'moonpay' | 'coinbase' | 'stripe'

export type BuyFormState = {
  amount: string
  currency: string
  asset: Asset
  providerId: BuyProviderId
}

export const defaultBuyFormState: BuyFormState = {
  amount: '10.00',
  currency: 'USD',
  asset: {
    type: 'native',
    balance: BigInt(0),
  },
  providerId: 'coinbase',
}

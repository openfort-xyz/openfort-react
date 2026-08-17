import {
  AuthProvider,
  ChainTypeEnum,
  type OpenfortProvider,
  type OpenfortWalletConfig,
  RecoveryMethod,
} from '@openfort/react'
import { base, polygonAmoy } from 'viem/chains'
import { create } from 'zustand'
import {
  DEFAULT_EVM_CHAIN,
  getFundingConfigForKey,
  PLAYGROUND_EVM_CHAINS,
  SOLANA_CLUSTER,
  SOLANA_DEFAULT_RPC,
  WALLET_RPC_URLS,
} from '@/lib/chains'

const polygonMintContract = import.meta.env.VITE_POLYGON_MINT_CONTRACT as `0x${string}` | undefined

const walletAssets: Record<number, `0x${string}`[]> = {
  [base.id]: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'], // USDC on Base
}
if (polygonMintContract) walletAssets[polygonAmoy.id] = [polygonMintContract]

const defaultWalletConfig: OpenfortWalletConfig = {
  shieldPublishableKey: import.meta.env.VITE_SHIELD_PUBLISHABLE_KEY,
  chainType: ChainTypeEnum.EVM,
  ethereum: {
    chainId: DEFAULT_EVM_CHAIN.id,
    rpcUrls: WALLET_RPC_URLS,
    ethereumFeeSponsorshipId: Object.fromEntries(
      PLAYGROUND_EVM_CHAINS.map((c) => [c.id, import.meta.env.VITE_FEE_SPONSORSHIP_ID!])
    ),
    assets: walletAssets,
  },
  solana: {
    cluster: SOLANA_CLUSTER,
    rpcUrls: {
      [SOLANA_CLUSTER]: SOLANA_DEFAULT_RPC,
    },
  },

  // If you want to use AUTOMATIC embedded wallet recovery, an encryption session is required.
  // See: https://www.openfort.io/docs/products/embedded-wallet/server/automatic-recovery-session
  // For backend setup, check: https://github.com/openfort-xyz/openfort-backend-quickstart
  getEncryptionSession: undefined, // Optional function to get the encryption session
  createEncryptedSessionEndpoint:
    import.meta.env.VITE_CREATE_ENCRYPTED_SESSION_ENDPOINT ||
    'https://create-next-app.openfort.io/api/protected-create-encryption-session',
  connectOnLogin: true,

  requestWalletRecoverOTP: async ({ userId, email, phone }) => {
    await fetch(import.meta.env.VITE_REQUEST_WALLET_RECOVER_OTP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId, email, phone }),
    })
  },
}

const defaultProviderOptions: Parameters<typeof OpenfortProvider>[0] = {
  publishableKey: import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY,

  uiConfig: {
    // Funding rail JSON API: serves /v2/funding/* (chains + sessions) and drives
    // the Deposit widget / useFunding().isAvailable. Consolidated into the main
    // Openfort api; set VITE_FUNDING_BASE_URL (see .env.local) to point at a local
    // backend. Not to be confused with depositPageUrl (the hosted Deposit page).
    fundingBaseUrl: import.meta.env.VITE_FUNDING_BASE_URL || 'https://api.openfort.io',
    // Mainnet e2e: source major tokens from mainnet chains, land on Base mainnet
    // USDC (the live embedded wallet's chain). Explicit symbols (not the 'native'
    // sentinel) so only Relay-supported deposit-address tokens show — e.g. ETH is
    // routable but Polygon's POL isn't ("major tokens" only). ETH uses a 0.01-unit
    // mint nominal so it isn't 1 whole ETH (see nominalUnits).
    // Funding SOURCE chains/currencies matched to the key environment (testnet vs
    // mainnet). The funding TARGET is owned by FundingTargetSync, which follows the
    // active chain — not set here. depositPageUrl omitted → SDK default
    // (https://deposit.openfort.io), the zero-config path a real integrator gets.
    funding: getFundingConfigForKey(import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY),
    theme: 'auto',
    mode: undefined,
    customTheme: undefined,
    authProviders: [
      AuthProvider.GUEST,
      AuthProvider.EMAIL_OTP,
      AuthProvider.PHONE,
      AuthProvider.GOOGLE,
      AuthProvider.WALLET,
    ],
    phoneConfig: {
      defaultCountry: 'us',
    },
    avoidLayoutShift: undefined,
    bufferPolyfill: undefined,
    customAvatar: undefined,
    disclaimer: undefined,
    walletConnectName: undefined,
    embedGoogleFonts: undefined,
    enforceSupportedChains: undefined,
    hideBalance: undefined,
    hideRecentBadge: undefined,
    hideTooltips: undefined,
    logo: undefined,
    overlayBlur: undefined,
    privacyPolicyUrl: undefined,
    termsOfServiceUrl: undefined,
    skipEmailVerification: undefined,
    walletConnectCTA: undefined,
    authProvidersLength: undefined,

    // linkWalletOnSignUp: LinkWalletOnSignUpOption.OPTIONAL,
    walletRecovery: {
      defaultMethod: RecoveryMethod.AUTOMATIC,
      allowedMethods: [RecoveryMethod.PASSWORD, RecoveryMethod.AUTOMATIC, RecoveryMethod.PASSKEY],
    },
    customPageComponents: undefined,
  },

  walletConfig: defaultWalletConfig,
  onConnect: undefined,
  onDisconnect: undefined,

  overrides: {
    backendUrl: import.meta.env.VITE_API_URL,
    crypto: undefined,
    storage: undefined,
    iframeUrl: import.meta.env.VITE_IFRAME_API_URL,
    shieldUrl: import.meta.env.VITE_SHIELD_URL,
  },
  thirdPartyAuth: undefined,
  debugMode: {
    openfortReactDebugMode: false,
    openfortCoreDebugMode: false,
    shieldDebugMode: false,
  },
}

interface Store {
  providerOptions: Parameters<typeof OpenfortProvider>[0]
  setProviderOptions: (options: Parameters<typeof OpenfortProvider>[0]) => void
}

export const useAppStore = create<Store>((set) => ({
  providerOptions: defaultProviderOptions,
  setProviderOptions: (options) => set({ providerOptions: options }),
}))

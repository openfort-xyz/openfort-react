import {
  AuthProvider,
  ChainTypeEnum,
  type OpenfortProvider,
  type OpenfortWalletConfig,
  RecoveryMethod,
} from '@openfort/react'
import { polygonAmoy } from 'viem/chains'
import { create } from 'zustand'
import { DEFAULT_EVM_CHAIN, PLAYGROUND_EVM_CHAINS, RPC_URLS, SOLANA_CLUSTER, SOLANA_DEFAULT_RPC } from '@/lib/chains'

const defaultWalletConfig: OpenfortWalletConfig = {
  shieldPublishableKey: import.meta.env.VITE_SHIELD_PUBLISHABLE_KEY,
  chainType: ChainTypeEnum.EVM,
  ethereum: {
    chainId: DEFAULT_EVM_CHAIN.id,
    rpcUrls: RPC_URLS,
    ethereumFeeSponsorshipId: Object.fromEntries(
      PLAYGROUND_EVM_CHAINS.map((c) => [c.id, import.meta.env.VITE_FEE_SPONSORSHIP_ID!])
    ),
    assets: {
      [polygonAmoy.id]: [import.meta.env.VITE_POLYGON_MINT_CONTRACT!],
    },
  },
  solana: {
    cluster: SOLANA_CLUSTER,
    rpcUrls: {
      [SOLANA_CLUSTER]: SOLANA_DEFAULT_RPC,
    },
  },

  // If you want to use AUTOMATIC embedded wallet recovery, an encryption session is required.
  // See: https://www.openfort.io/docs/products/embedded-wallet/react-native/quickstart/automatic
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
    reducedMotion: undefined,
    skipEmailVerification: undefined,
    truncateLongENSAddress: undefined,
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

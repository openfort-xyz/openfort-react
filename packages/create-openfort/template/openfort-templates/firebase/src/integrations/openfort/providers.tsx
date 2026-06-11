import { OpenfortProvider, ThirdPartyOAuthProvider } from '@openfort/react'
import { getDefaultConfig, OpenfortWagmiBridge } from '@openfort/react/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beamTestnet, polygonAmoy, sepolia } from 'viem/chains'
import { createConfig, WagmiProvider } from 'wagmi'

import { auth } from '../firebase'

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: 'Openfort React demo',
    chains: [beamTestnet, polygonAmoy, sepolia], // Supported chains
    walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID, // WalletConnect Project ID
  }),
)

const queryClient = new QueryClient()

// Firebase's getIdToken(false) uses its own internal cache and only refreshes
// when the token is near expiry — no navigator lock, no starvation risk.
// Objects are defined outside the component for stable references so
// OpenfortProvider doesn't re-render from reference inequality.
const thirdPartyAuth = {
  provider: ThirdPartyOAuthProvider.FIREBASE,
  getAccessToken: async (): Promise<string | null> => {
    return (await auth.currentUser?.getIdToken(/* forceRefresh */ false)) ?? null
  },
}

const walletConfig = {
  shieldPublishableKey: import.meta.env.VITE_SHIELD_PUBLISHABLE_KEY!,
  ethereum: {
    ethereumFeeSponsorshipId: import.meta.env.VITE_FEE_SPONSORSHIP_ID,
  },
  createEncryptedSessionEndpoint: import.meta.env.VITE_CREATE_ENCRYPTED_SESSION_ENDPOINT,
  connectOnLogin: false, // Wallet creation handled manually after auth
}

export function OpenfortProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <OpenfortWagmiBridge>
          <OpenfortProvider
            debugMode
            publishableKey={import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY!}
            walletConfig={walletConfig}
            thirdPartyAuth={thirdPartyAuth}
          >
            {children}
          </OpenfortProvider>
        </OpenfortWagmiBridge>
      </WagmiProvider>
    </QueryClientProvider>
  )
}

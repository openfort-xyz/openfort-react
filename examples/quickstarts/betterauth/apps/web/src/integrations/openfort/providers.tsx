import { OpenfortProvider, ThirdPartyOAuthProvider } from '@openfort/react'
import { getDefaultConfig, OpenfortWagmiBridge } from '@openfort/react/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beamTestnet, polygonAmoy, sepolia } from 'viem/chains'
import { createConfig, WagmiProvider } from 'wagmi'

import { authClient } from '../betterauth'

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: 'Openfort React demo',
    chains: [beamTestnet, polygonAmoy, sepolia], // Supported chains
    walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID, // WalletConnect Project ID
  }),
)

const queryClient = new QueryClient()

if (!import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY) {
  throw new Error('VITE_OPENFORT_PUBLISHABLE_KEY is required')
}
if (!import.meta.env.VITE_SHIELD_PUBLISHABLE_KEY) {
  throw new Error('VITE_SHIELD_PUBLISHABLE_KEY is required')
}

const thirdPartyAuth = {
  provider: ThirdPartyOAuthProvider.BETTER_AUTH,
  getAccessToken: async (): Promise<string | null> => {
    const session = await authClient.getSession()
    return session?.data?.session?.token ?? null
  },
}

const walletConfig = {
  shieldPublishableKey: import.meta.env.VITE_SHIELD_PUBLISHABLE_KEY!,
  ethereum: {
    ethereumFeeSponsorshipId: import.meta.env.VITE_FEE_SPONSORSHIP_ID,
  },
  // For AUTOMATIC embedded wallet recovery an encryption session is required.
  // See: https://www.openfort.io/docs/products/embedded-wallet/react-native/quickstart/automatic
  // For backend setup: https://github.com/openfort-xyz/openfort-backend-quickstart
  getEncryptionSession: async (): Promise<string | null> => {
    try {
      const session = await authClient.getSession()
      const token = session?.data?.session?.token
      if (!token) {
        console.error('Better Auth - No token available')
        return null
      }
      const response = await fetch(
        `${import.meta.env.VITE_BETTERAUTH_URL + import.meta.env.VITE_BETTERAUTH_BASE_PATH}/encryption-session`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      )
      if (!response.ok) {
        console.error('Better Auth - Failed to get encryption session:', response.status)
        return null
      }
      const data = await response.json()
      console.log('Better Auth - Retrieved encryption session:', data)
      return data.sessionId ?? null
    } catch (error) {
      console.error('Better Auth - Error getting encryption session:', error)
      return null
    }
  },
  connectOnLogin: true,
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

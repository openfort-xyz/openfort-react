import { OpenfortProvider, ThirdPartyOAuthProvider } from '@openfort/react'
import { getDefaultConfig, OpenfortWagmiBridge } from '@openfort/react/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beamTestnet, polygonAmoy, sepolia } from 'viem/chains'
import { createConfig, WagmiProvider } from 'wagmi'

import { supabase } from '../supabase'

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: 'Openfort React demo',
    chains: [beamTestnet, polygonAmoy, sepolia],
    walletConnectProjectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
  }),
)

const queryClient = new QueryClient()

// Cache the token from auth state changes to avoid repeated lock acquisitions.
// getSession() acquires the navigator lock on every call — when the SDK calls
// getAccessToken concurrently from multiple effects, this causes lock starvation
// and a feedback loop of INITIAL_SESSION events.
let cachedToken: string | null = null
supabase.auth.onAuthStateChange((_event, session) => {
  cachedToken = session?.access_token ?? null
})

const thirdPartyAuth = {
  provider: ThirdPartyOAuthProvider.SUPABASE,
  getAccessToken: async (): Promise<string | null> => {
    if (cachedToken) return cachedToken
    // Cold-start fallback: auth state change hasn't fired yet
    const { data: { session } } = await supabase.auth.getSession()
    cachedToken = session?.access_token ?? null
    return cachedToken
  },
}

const walletConfig = {
  shieldPublishableKey: import.meta.env.VITE_SHIELD_PUBLISHABLE_KEY!,
  ethereum: {
    ethereumFeeSponsorshipId: import.meta.env.VITE_FEE_SPONSORSHIP_ID,
  },
  createEncryptedSessionEndpoint:
    import.meta.env.VITE_CREATE_ENCRYPTED_SESSION_BASE_URL +
    import.meta.env.VITE_CREATE_ENCRYPTED_SESSION_ENDPOINT,
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

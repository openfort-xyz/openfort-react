import { ChainTypeEnum, OpenfortProvider } from '@openfort/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <OpenfortProvider
        publishableKey={import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY}
        walletConfig={{
          shieldPublishableKey: import.meta.env.VITE_SHIELD_PUBLISHABLE_KEY,
          chainType: ChainTypeEnum.SVM,
          createEncryptedSessionEndpoint: import.meta.env.VITE_CREATE_ENCRYPTED_SESSION_ENDPOINT,
          connectOnLogin: true,
        }}
      >
        {children}
      </OpenfortProvider>
    </QueryClientProvider>
  )
}

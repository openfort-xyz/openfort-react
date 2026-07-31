// Compiles against the built package the way a consumer does. With
// skipLibCheck off, tsc follows every import inside the shipped .d.ts.

import type { User, UserQueryOptions } from '@openfort/react'
import { getUserQueryOptions, OpenfortButton, OpenfortProvider, useUser } from '@openfort/react'
// Each subpath entry point exists so consumers can pull in one chain family
// without the other. Resolving them here keeps the `exports` map honest under
// both `bundler` and `node16` resolution.
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { selectIsAuthenticated } from '@openfort/react/internal'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { getDefaultConfig } from '@openfort/react/wagmi'

export function App({ children }: { children: React.ReactNode }) {
  return (
    <OpenfortProvider publishableKey="pk_test_placeholder">
      {children}
      <OpenfortButton />
    </OpenfortProvider>
  )
}

// A representative public hook must keep its declared return type when resolved
// through the built declarations.
export function useCurrentUser(): User | null | undefined {
  return useUser().user
}

export function useEthereumAddress(): string | undefined {
  return useEthereumEmbeddedWallet().address
}

export function useSolanaAddress(): string | undefined {
  return useSolanaEmbeddedWallet().address
}

// The wagmi entry point builds a config, so its types have to resolve against
// the consumer's own wagmi and viem rather than a bundled copy.
export const wagmiConfig = getDefaultConfig({ appName: 'test-tsc' })

// Store selectors are typed against the store state, which the internal entry
// point exports separately from the public API.
export const isAuthenticatedSelector = selectIsAuthenticated

// The query-option factories are the exports whose declarations are hardest to
// emit, because TanStack infers their return type and tags the key with symbols
// it does not export. Naming the return type here holds them to a type a
// consumer can write down, and pins the tagged payload the key carries.
export const userQueryOptions: UserQueryOptions = getUserQueryOptions(
  null as unknown as Parameters<typeof getUserQueryOptions>[0]
)
export const userQueryKey: readonly ['openfort', 'user'] = userQueryOptions.queryKey

'use client'

import { QueryClient, QueryClientContext, QueryClientProvider } from '@tanstack/react-query'
import type { Context, PropsWithChildren } from 'react'
import { useContext, useState } from 'react'

/**
 * Guarantees a `QueryClient` is available to everything Openfort renders.
 *
 * When the app already provides one — every wagmi app does, since wagmi requires
 * a `QueryClientProvider` — that client is used as-is, so Openfort's queries share
 * the app's cache and respond to the app's `invalidateQueries` calls. Only when no
 * client is in scope does Openfort create and provide one of its own, which keeps
 * headless (non-wagmi) integrations working without extra setup and avoids ever
 * nesting a second provider.
 */
export function QueryClientBoundary({ children }: PropsWithChildren) {
  // Compatibility test matrices can install TanStack Query with a different
  // React type copy. Context identity is runtime-safe; normalize its type at
  // this package boundary so React 18 and 19 consumers both compile.
  const appQueryClient = useContext(QueryClientContext as unknown as Context<QueryClient | undefined>)
  const [ownQueryClient] = useState(() => (appQueryClient ? null : new QueryClient()))

  if (!ownQueryClient) return <>{children}</>
  return <QueryClientProvider client={ownQueryClient}>{children}</QueryClientProvider>
}

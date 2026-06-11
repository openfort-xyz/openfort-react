import { useWalletAuth } from '@openfort/react/wagmi'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { HookVariable } from '@/components/Variable/HookVariable'
import type { HookInput } from '@/components/Variable/Variable'
import { usePlaygroundMode } from '@/providers'
import { Layout } from '../../../components/Layout'

export const Route = createFileRoute('/_hooks/auth/useWalletAuth')({
  component: RouteComponent,
})

const baseVariables: Record<string, HookInput> = {
  availableWallets: {
    description: 'List of available external wallet connectors (excludes embedded wallet).',
  },
  connectWallet: {
    description:
      'Connect wallet and sign in with SIWE. Call with connector id and optional callbacks (onConnect, onError).',
  },
  linkWallet: {
    description: 'Connect wallet and link to existing account via SIWE. Call with connector id and optional callbacks.',
  },
  walletConnectingTo: {
    description: 'Connector id currently being connected (null when idle). Use for loading UI.',
  },
  isLoading: {
    description: 'True while connect/link flow is in progress.',
  },
  isError: {
    description: 'True when the last connect/link failed.',
  },
  isSuccess: {
    description: 'True when the last connect/link succeeded.',
  },
  error: {
    description: 'OpenfortError from the last failed connect/link (if any).',
  },
}

function RouteComponent() {
  const { mode } = usePlaygroundMode()

  if (mode !== 'evm') {
    return <Navigate to="/" />
  }

  return (
    <Layout>
      <HookVariable
        name="useWalletAuth"
        hook={useWalletAuth}
        importPath="@openfort/react/wagmi"
        description="List external wallets (MetaMask, WalletConnect, etc.) and connect or link via SIWE. EVM (wagmi) only."
        variables={(values) => {
          const v = values as {
            availableWallets?: { id: string; name: string }[]
            connectWallet: (connectorId: string, callbacks?: unknown) => void | Promise<void>
            linkWallet: (connectorId: string, callbacks?: unknown) => void | Promise<void>
          }
          const wallets = v.availableWallets ?? []
          const connectorOptions =
            wallets.length > 0
              ? wallets.map((w) => ({ label: w.name, value: w.id }))
              : [{ label: '— No connectors (wait for wagmi) —', value: '' }]
          return {
            ...baseVariables,
            connectWallet: {
              ...baseVariables.connectWallet,
              override: (opts: { connectorId?: string }) => v.connectWallet(opts.connectorId ?? ''),
              inputs: {
                connectorId: {
                  type: 'select',
                  options: connectorOptions,
                  required: true,
                  description: 'Wallet connector to use',
                },
              },
            },
            linkWallet: {
              ...baseVariables.linkWallet,
              override: (opts: { connectorId?: string }) => v.linkWallet(opts.connectorId ?? ''),
              inputs: {
                connectorId: {
                  type: 'select',
                  options: connectorOptions,
                  required: true,
                  description: 'Wallet connector to link',
                },
              },
            },
          }
        }}
      />
    </Layout>
  )
}

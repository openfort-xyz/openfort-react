import { RecoveryMethod } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '@/components/Layout'
import { onSettledOptions } from '@/components/Variable/commonVariables'
import { HookVariable } from '@/components/Variable/HookVariable'
import { DEFAULT_EVM_CHAIN } from '@/lib/chains'
import { usePlaygroundMode } from '@/providers'

export const Route = createFileRoute('/_hooks/wallet/useEthereumEmbeddedWallet')({
  component: RouteComponent,
})

const evmDefaultOptions = { ...onSettledOptions, chainId: DEFAULT_EVM_CHAIN.id }

function EvmContent() {
  return (
    <HookVariable
      name="useEthereumEmbeddedWallet"
      hook={useEthereumEmbeddedWallet}
      description="Ethereum embedded wallet hook (viem/openfort-js only, no wagmi). Use for create, setActive, wallets, and activeWallet."
      defaultOptions={evmDefaultOptions}
      variables={{
        setActive: {
          description: 'Set the active embedded wallet by address.',
          inputs: {
            address: {
              type: 'text',
              placeholder: '0x...',
              required: true,
            },
            recoveryMethod: {
              type: 'select',
              options: ['undefined', RecoveryMethod.PASSWORD, RecoveryMethod.PASSKEY, RecoveryMethod.AUTOMATIC],
            },
            password: {
              type: 'password',
            },
          },
        },
        exportPrivateKey: {
          description: 'Export the private key of the active wallet.',
        },
        create: {
          description: 'Create a new embedded wallet.',
          inputs: {
            recoveryMethod: {
              type: 'select',
              options: ['undefined', RecoveryMethod.PASSWORD, RecoveryMethod.PASSKEY, RecoveryMethod.AUTOMATIC],
            },
            password: {
              type: 'password',
            },
          },
        },
        setRecovery: {
          description: 'Update recovery method for the wallet.',
        },
        activeWallet: {
          description: 'The currently active embedded wallet (when status is connected).',
          typescriptType: 'ConnectedEmbeddedEthereumWallet | null',
        },
        wallets: {
          description: 'List of embedded Ethereum wallets.',
          typescriptType: 'ConnectedEmbeddedEthereumWallet[]',
        },
        status: {
          description:
            'Current wallet state: disconnected | fetching-wallets | connecting | creating | connected | needs-recovery | error.',
        },
      }}
    />
  )
}

function SolanaContent() {
  return (
    <HookVariable
      name="useSolanaEmbeddedWallet"
      hook={useSolanaEmbeddedWallet}
      description="Solana embedded wallet hook. Use for create, setActive, wallets, and activeWallet (Base58 addresses)."
      variables={{
        setActive: {
          description: 'Set the active embedded wallet by address.',
        },
        create: {
          description: 'Create a new Solana embedded wallet.',
        },
        activeWallet: {
          description: 'The currently active embedded wallet (when status is connected).',
        },
        wallets: {
          description: 'List of embedded Solana wallets.',
        },
        status: {
          description:
            'Current wallet state: disconnected | fetching-wallets | connecting | creating | connected | needs-recovery | error.',
        },
      }}
    />
  )
}

function RouteComponent() {
  const { mode } = usePlaygroundMode()
  const isSVM = mode === 'svm'

  return (
    <Layout>
      <p className="text-sm text-muted-foreground">
        Use <code>useEthereumEmbeddedWallet()</code> or <code>useSolanaEmbeddedWallet()</code> directly based on your
        chain. This page shows both chain-specific hooks for inspection.
      </p>
      {isSVM ? <SolanaContent /> : <EvmContent />}
    </Layout>
  )
}

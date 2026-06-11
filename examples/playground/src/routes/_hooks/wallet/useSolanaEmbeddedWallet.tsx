import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '@/components/Layout'
import { HookVariable } from '@/components/Variable/HookVariable'

export const Route = createFileRoute('/_hooks/wallet/useSolanaEmbeddedWallet')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Layout>
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
    </Layout>
  )
}

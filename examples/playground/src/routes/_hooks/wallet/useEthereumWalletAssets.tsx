import { useEthereumWalletAssets } from '@openfort/react/ethereum'
import { createFileRoute } from '@tanstack/react-router'
import { HookVariable } from '@/components/Variable/HookVariable'
import { Layout } from '../../../components/Layout'

export const Route = createFileRoute('/_hooks/wallet/useEthereumWalletAssets')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Layout>
      <HookVariable
        name="useEthereumWalletAssets"
        hook={useEthereumWalletAssets}
        description="Fetches wallet assets (tokens, NFTs) for the connected wallet."
        variables={{}}
        defaultOptions={{}}
      />
    </Layout>
  )
}

import { useConnectWithSiwe } from '@openfort/react/wagmi'
import { createFileRoute } from '@tanstack/react-router'
import { HookVariable } from '@/components/Variable/HookVariable'
import { Layout } from '../../../components/Layout'

export const Route = createFileRoute('/_hooks/auth/useConnectWithSiwe')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Layout>
      <HookVariable
        name="useConnectWithSiwe"
        hook={useConnectWithSiwe}
        description="Connect or link an external wallet via SIWE (Sign-In with Ethereum). Requires @openfort/react/wagmi bridge."
        variables={{
          connectWithSiwe: {
            description: 'Authenticate or link an external wallet using SIWE.',
          },
        }}
      />
    </Layout>
  )
}

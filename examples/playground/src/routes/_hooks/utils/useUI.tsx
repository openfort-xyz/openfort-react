import { useUI } from '@openfort/react'
import { createFileRoute } from '@tanstack/react-router'
import { HookVariable } from '@/components/Variable/HookVariable'
import { Layout } from '../../../components/Layout'

export const Route = createFileRoute('/_hooks/utils/useUI')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <Layout>
      <HookVariable
        name="useUI"
        hook={useUI}
        description="This hook provides access to the UI components and methods for managing the UI state."
        variables={{
          open: {
            description: 'Open a UI component.',
          },
          close: {
            description: 'Close a UI component.',
          },
          openWallets: {
            description: 'Open the wallets UI.',
          },
          openProfile: {
            description: 'Open the user profile UI. If the user is not authenticated, it will open the login UI.',
          },
          openProviders: {
            description: 'Open the auth providers UI.',
          },
          openSwitchNetworks: {
            description: 'Open the switch networks UI.',
          },
          openSend: {
            description:
              'Open the Send flow for the active chain. Pass a transaction to prefill it and jump straight to the confirmation screen.',
          },
          openReceive: {
            description: 'Open the Receive screen (address + QR) for the active chain.',
          },
          openFunding: {
            description: 'Open the Deposit hub — every way to add funds: crypto transfer, exchange, or fiat.',
          },
          openBuy: {
            description: 'Open the Buy screen, the fiat amount entry that leads into the card / wallet-pay rails.',
          },
          openExportKey: {
            description: 'Open the export private key flow for the embedded wallet.',
          },
          openSettings: {
            description: 'Open the wallet profile / settings screen.',
          },
        }}
      />
    </Layout>
  )
}

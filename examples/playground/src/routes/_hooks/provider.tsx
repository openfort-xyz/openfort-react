import type { RecoveryMethod, Theme } from '@openfort/react'
import { createFileRoute } from '@tanstack/react-router'
import { Layout } from '../../components/Layout'
import { Variable } from '../../components/Variable/Variable'
import { useAppStore } from '../../lib/useAppStore'

export const Route = createFileRoute('/_hooks/provider')({
  component: RouteComponent,
})

// Geographies worth simulating: the three routing outcomes (US → Coinbase,
// EU → Stripe embedded, rest-of-world → Meld/hidden) plus an IP-detect option.
const SIMULATED_COUNTRIES = ['US', 'DE', 'ES', 'FR', 'GB', 'BR']

/**
 * Local-dev funding controls. Country stands in for the CDN geo header that
 * localhost never has; the mainnet-target pin makes fiat rows resolvable on a
 * test key (onramp coverage is mainnet-only, and test keys pin the target to
 * Base Sepolia otherwise).
 */
function FundingSimulationCard() {
  const fundingSimulation = useAppStore((s) => s.fundingSimulation)
  const setFundingSimulation = useAppStore((s) => s.setFundingSimulation)

  return (
    <div className="mb-6 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">Funding simulation</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Simulate the buyer's geography and a mainnet funding target to exercise the fiat onramp rows locally.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          Buyer country
          <select
            className="rounded-md border bg-transparent px-2 py-1 text-sm"
            value={fundingSimulation.country ?? ''}
            onChange={(e) => setFundingSimulation({ ...fundingSimulation, country: e.target.value || undefined })}
          >
            <option value="">Detect by IP</option>
            {SIMULATED_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fundingSimulation.mainnetTarget}
            onChange={(e) => setFundingSimulation({ ...fundingSimulation, mainnetTarget: e.target.checked })}
          />
          Pin target to Base mainnet USDC (fiat methods resolve on test keys)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fundingSimulation.fakeApplePay === true}
            onChange={(e) => setFundingSimulation({ ...fundingSimulation, fakeApplePay: e.target.checked })}
          />
          Simulate an Apple Pay–capable device (shows the Apple Pay row anywhere)
        </label>
      </div>
    </div>
  )
}

function RouteComponent() {
  const { providerOptions, setProviderOptions } = useAppStore()

  return (
    <Layout>
      <FundingSimulationCard />
      <Variable
        name="providerOptions"
        values={providerOptions}
        defaultExpanded={10}
        variables={{
          mode: {
            type: 'select',
            typescriptType: "'auto' | 'dark' | 'light' | undefined",
            description: 'The theme mode of the Openfort provider. By default, it will use the system preference.',
            options: ['undefined', 'auto', 'dark', 'light'],
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                uiConfig: {
                  ...providerOptions.uiConfig,
                  mode: (value ?? 'auto') as 'auto' | 'dark' | 'light',
                },
              })
            },
          },
          customTheme: {
            description: `Custom theme for the Openfort components. This field is optional. For example "customTheme: { '--ck-font-family': 'monospace' }"`,
          },
          theme: {
            type: 'select',
            options: ['auto', 'web95', 'retro', 'soft', 'midnight', 'minimal', 'rounded', 'nouns'],
            description: 'The theme to use for the Openfort components. This field is optional.',
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                uiConfig: {
                  ...providerOptions.uiConfig,
                  theme: value as Theme,
                },
              })
            },
          },
          publishableKey: {
            description: 'The publishable key of your Openfort account. This field is required.',
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                publishableKey: value as string,
              })
            },
          },
          debugMode: {
            description:
              'Enable or disable debug mode. When enabled, additional debugging information will be logged to the console.',
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                debugMode: value as boolean,
              })
            },
            type: 'boolean',
          },
          uiConfig: {
            description: 'The configuration for the Openfort UI components. This field is optional.',
          },
          walletConfig: {
            description:
              'The configuration for the Openfort wallet components. If not set, users will need to connect their web3 wallets.',
          },
          recoveryMethod: {
            description: 'The recovery method to use for the embedded wallet.',
            type: 'select',
            options: ['automatic', 'password'],
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                walletConfig: {
                  ...providerOptions.walletConfig,
                  // @ts-expect-error ts is not aware of the walletConfig type
                  recoveryMethod: value as RecoveryMethod,
                },
              })
            },
          },
          termsOfServiceUrl: {
            type: 'text',
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                uiConfig: {
                  ...providerOptions.uiConfig,
                  termsOfServiceUrl: value as string,
                },
              })
            },
          },
          walletConnectName: {
            type: 'text',
            description:
              'The name of the wallet connect session. This is used to identify the session in the wallet connect app.',
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                uiConfig: {
                  ...providerOptions.uiConfig,
                  walletConnectName: value as string,
                },
              })
            },
          },
          reducedMotion: {
            type: 'boolean',
            description:
              'Whether to reduce motion in the UI. This is useful for users who prefer less motion in the UI.',
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                uiConfig: {
                  ...providerOptions.uiConfig,
                  reducedMotion: Boolean(value),
                },
              })
            },
          },
          logo: {
            type: 'text',
            typescriptType: 'React.ReactNode | string | undefined',
            description: 'The URL or Component of the logo to use in the Openfort components. This is optional.',
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                uiConfig: {
                  ...providerOptions.uiConfig,
                  logo: value as string,
                },
              })
            },
          },
          walletConnectCTA: {
            type: 'select',
            options: ['undefined', 'link', 'modal', 'both'],
            description:
              'The call to action text for the wallet connect button. This is used to prompt users to connect their wallet using WalletConnect.',
            onEdit: (value) => {
              setProviderOptions({
                ...providerOptions,
                uiConfig: {
                  ...providerOptions.uiConfig,
                  walletConnectCTA: value === 'undefined' ? undefined : (value as 'link' | 'modal' | 'both'),
                },
              })
            },
          },
        }}
      />
    </Layout>
  )
}

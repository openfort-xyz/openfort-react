import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/lib/useAppStore'

/**
 * The three routing outcomes the fiat rails actually produce, verified against
 * the funding api. Region is the only lever the simulation has — the buyer picks
 * the method in the widget — so each preset pins a country and lists what the
 * three method rows should resolve to there. Routes assume the default deposit
 * target (Base USDC): routing is target-dependent, and with chained (Relay)
 * routes off a provider only wins a row when it delivers that target directly.
 *
 * Every preset also sets `mainnetTarget` (fiat coverage is mainnet-only, so a
 * test key pinned to Base Sepolia shows no fiat rows at all) and `fakeApplePay`
 * (the wallet-pay row needs ApplePaySession to exist). Forgetting either is the
 * usual reason "no payment options" shows up.
 */
const SCENARIOS = [
  {
    country: 'US',
    label: 'United States',
    routes: [
      ['Apple / Google Pay', 'Coinbase — native in-page'],
      ['Card', 'Stripe — embedded'],
      ['Bank transfer', 'Stripe — embedded (ACH)'],
    ],
  },
  {
    country: 'DE',
    label: 'Europe (DE)',
    // Stripe's EU delivery is USDC·Ethereum ONLY and chained (Relay-bridged)
    // routes are switched off, so with the default Base target every method
    // falls to the hosted popup. Point the deposit at Ethereum USDC to see the
    // Stripe embedded flow here.
    routes: [
      ['Apple / Google Pay', 'Coinbase — hosted popup (Stripe embedded on ETH USDC)'],
      ['Card', 'Coinbase — hosted popup (Stripe embedded on ETH USDC)'],
      ['Bank transfer', 'Coinbase — hosted popup (SEPA)'],
    ],
  },
  {
    country: 'BR',
    label: 'Rest of world (BR)',
    routes: [
      ['Apple / Google Pay', 'Coinbase — hosted popup'],
      ['Card', 'Coinbase — hosted popup'],
      ['Bank transfer', 'Coinbase — hosted popup'],
    ],
  },
] as const

/** Extra geographies worth poking at by hand; the presets cover the three outcomes. */
const OTHER_COUNTRIES = ['ES', 'FR', 'GB']

/**
 * Funding scenario switcher — presets for the three routing outcomes, plus the
 * raw simulation fields for ad-hoc cases. Rendered both on the provider settings
 * page and in the showcase app, so the widget can be re-aimed without leaving it.
 */
export function FundingScenarios({ bare }: { bare?: boolean } = {}) {
  const simulation = useAppStore((s) => s.fundingSimulation)
  const setSimulation = useAppStore((s) => s.setFundingSimulation)
  const active = SCENARIOS.find((s) => s.country === simulation.country)

  const body = (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {SCENARIOS.map((scenario) => (
          <Button
            key={scenario.country}
            variant={active?.country === scenario.country ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSimulation({ country: scenario.country, mainnetTarget: true, fakeApplePay: true })}
          >
            {scenario.label}
          </Button>
        ))}
      </div>

      {active ? (
        <dl className="rounded-md border p-3 text-xs">
          {active.routes.map(([method, route]: readonly [string, string]) => (
            <div key={method} className="flex justify-between gap-3 py-0.5">
              <dt className="text-muted-foreground">{method}</dt>
              <dd className="text-right font-mono">{route}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">
          No preset active — the rows below are whatever the manual settings resolve to.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-sm">
        <label className="flex items-center gap-2">
          Country
          <select
            className="rounded-md border bg-transparent px-2 py-1 text-sm"
            value={simulation.country ?? ''}
            onChange={(e) => setSimulation({ ...simulation, country: e.target.value || undefined })}
          >
            <option value="">Detect by IP</option>
            {[...SCENARIOS.map((s) => s.country), ...OTHER_COUNTRIES].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulation.mainnetTarget}
            onChange={(e) => setSimulation({ ...simulation, mainnetTarget: e.target.checked })}
          />
          Mainnet target
        </label>
        {simulation.mainnetTarget && (
          <label className="flex items-center gap-2">
            Target
            <select
              className="rounded-md border bg-transparent px-2 py-1 text-sm"
              value={simulation.mainnetTargetChain ?? 'base'}
              onChange={(e) =>
                setSimulation({ ...simulation, mainnetTargetChain: e.target.value as 'base' | 'ethereum' })
              }
            >
              <option value="base">Base USDC</option>
              {/* Stripe's EU delivery is USDC·Ethereum only — pick this to see the embedded flow from the EU. */}
              <option value="ethereum">Ethereum USDC</option>
            </select>
          </label>
        )}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={simulation.fakeApplePay === true}
            onChange={(e) => setSimulation({ ...simulation, fakeApplePay: e.target.checked })}
          />
          Apple Pay–capable device
        </label>
      </div>
    </div>
  )

  if (bare) return body

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funding scenarios</CardTitle>
        <CardDescription>
          Simulate the buyer's region to exercise each onramp rail. Localhost has no geo header, so without an override
          every buyer looks rest-of-world.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">{body} </CardContent>
    </Card>
  )
}

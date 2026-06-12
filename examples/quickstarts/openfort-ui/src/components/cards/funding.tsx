import { useFunding } from '@openfort/react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { TruncateData } from '../ui/TruncateData'

// Mainnet USDC across a few chains → received as USDC on Base.
const SOURCES = [
  { label: 'USDC · Polygon', chain: 'eip155:137', currency: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  { label: 'USDC · Arbitrum', chain: 'eip155:42161', currency: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  { label: 'USDC · Base', chain: 'eip155:8453', currency: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { label: 'USDC · Optimism', chain: 'eip155:10', currency: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
]
const DEST_BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const inputClass = 'w-full rounded bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100'

export const Funding = () => {
  const { address } = useAccount()
  const { session, status, error, isAvailable, fund, reset } = useFunding()
  const [idx, setIdx] = useState(0)
  const [amount, setAmount] = useState('10')
  const pm = session?.paymentMethod ?? null
  const source = SOURCES[idx]

  const run = () => {
    if (!address || !source) return
    const units = String(Math.round(Number(amount || '0') * 1e6))
    void fund(
      { chain: 'eip155:8453', currency: DEST_BASE_USDC, address },
      { type: 'evm', source: { chain: source.chain, currency: source.currency, amount: units } }
    ).catch(() => {})
  }

  return (
    <div className="flex flex-col w-full">
      <h2 className="mb-3">Headless funding</h2>
      <p className="mb-4 text-sm text-zinc-400">
        Drive a funding session directly with <code>useFunding()</code> — no modal. Pick a source, get a real Relay
        deposit address, and send.
      </p>

      {!isAvailable && <p className="mb-3 text-sm text-amber-400">Set uiConfig.fundingBaseUrl to enable.</p>}

      {!pm ? (
        <div className="space-y-3">
          <select className={inputClass} value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
            {SOURCES.map((s, i) => (
              <option key={s.chain} value={i}>
                {s.label}
              </option>
            ))}
          </select>
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button type="button" className="btn" onClick={run} disabled={!address || !isAvailable}>
            Get deposit address
          </button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div>
            Status: <span className="text-zinc-300">{status}</span>
          </div>
          <div>
            Send {amount} USDC on {source?.label} to:
          </div>
          <TruncateData data={pm.receiverAddress} />
          {pm.deeplinks.map((d) => (
            <div key={d.app}>
              <a className="text-violet-400" href={d.url}>
                {d.label}
              </a>
            </div>
          ))}
          <button type="button" className="btn mt-2" onClick={() => reset()}>
            Reset
          </button>
        </div>
      )}

      {error && <TruncateData data={error.message} className="text-red-500" />}
    </div>
  )
}

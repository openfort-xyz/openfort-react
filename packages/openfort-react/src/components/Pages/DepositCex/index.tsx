'use client'

import type { ChangeEvent, CSSProperties, ReactNode, SyntheticEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import logos from '../../../assets/logos'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useFunding } from '../../../hooks/openfort/useFunding'
import { useFundingChains } from '../../../hooks/openfort/useFundingChains'
import { logger } from '../../../utils/logger'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AmountCard, AmountInput, CurrencySymbol, PresetButton, PresetList, Section, SectionLabel } from '../Buy/styles'
import { walletListBtn } from '../Deposit/formStyles'
import { DEST_USDC } from '../Deposit/sources'
import { ButtonLogo, StepDivider } from '../Deposit/styles'
import { useFundingTarget } from '../Deposit/useFundingTarget'
import { sanitizeAmountInput, sanitizeForParsing } from '../Send/utils'

/** Exchange rails. Binance is gated until its rail lands. */
const EXCHANGES = [
  { id: 'coinbase', comingSoon: false },
  { id: 'binance', comingSoon: true },
] as const

/** Exchange brand logos keyed by exchange id. */
const EXCHANGE_LOGO: Record<string, ReactNode> = {
  coinbase: <logos.Coinbase background />,
  binance: <logos.Binance />,
}

/** Coinbase Onramp minimum (USD, ≈ USDC units); enforced client-side for UX. */
const MIN_AMOUNT = 5
const PRESETS = [10, 25, 50]

/** CAIP-2 chains Coinbase can deliver to — the only chains the CEX rail supports. */
const CHAIN_NAMES: Record<string, string> = {
  'eip155:1': 'Ethereum',
  'eip155:10': 'Optimism',
  'eip155:137': 'Polygon',
  'eip155:8453': 'Base',
  'eip155:42161': 'Arbitrum',
  'eip155:43114': 'Avalanche',
}
const COINBASE_CHAINS = new Set(Object.keys(CHAIN_NAMES))

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const helperText: CSSProperties = { fontSize: 12, color: 'var(--ck-body-color-muted, #6b7280)' }
const errorHelper: CSSProperties = { fontSize: 12, color: '#dc2626' }
const destinationRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, ...helperText }
const destinationLogo: CSSProperties = { width: 14, height: 14, borderRadius: '50%' }
const hideBrokenLogo = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

/**
 * Transfer from Exchange — the user enters an amount; "Open Coinbase" hands off to
 * a hosted Coinbase pay-link that delivers to the embedded wallet on the
 * destination chain. The destination (chain + currency + address) is bound to a
 * funding session created up-front, so the client can't redirect the funds — only
 * the amount is chosen here. No Relay routing and no live status tracking on this
 * rail (the hosted flow has no pollable id); Binance is gated until its rail lands.
 */
const DepositCex = () => {
  const { triggerResize } = useOpenfort()
  const target = useFundingTarget()
  const { isAvailable, createSession, payLink } = useFunding()
  const wallet = useEthereumEmbeddedWallet()
  const { chains } = useFundingChains()

  const [amount, setAmount] = useState(String(MIN_AMOUNT))
  const [pressedPreset, setPressedPreset] = useState<number | null>(null)
  const [session, setSession] = useState<{ id: string; clientSecret: string } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [opened, setOpened] = useState(false)

  const address = target.address ?? wallet.address
  const chainSupported = COINBASE_CHAINS.has(target.chain)

  // Resolve the destination asset + chain for the "Arrives as …" line. The live
  // chain list is curated for source selection, so the destination may be absent;
  // only claim a symbol we resolved, or USDC for the zero-config default.
  const destChain = chains.find((c) => c.id === target.chain)
  const destChainName = destChain?.name ?? CHAIN_NAMES[target.chain] ?? target.chain
  const destAsset = destChain?.currencies.find((c) => c.address.toLowerCase() === target.currency.toLowerCase())
  const isDefaultUsdc = target.currency.toLowerCase() === DEST_USDC.toLowerCase()
  const destAssetLabel = destAsset?.symbol ?? (isDefaultUsdc ? 'USDC' : null)
  const destAssetLogo = destAsset?.logo ?? null
  const destChainLogo = destChain?.logo ?? null

  // Mint the destination-bound session up-front (per target wallet), so the click
  // that opens Coinbase is a single fast pay-link call and stays popup-safe.
  const sessionKey = useRef('')
  useEffect(() => {
    if (!isAvailable || !address || !chainSupported) return
    const key = `${target.chain}|${target.currency}|${address}`
    if (sessionKey.current === key) return
    sessionKey.current = key
    let cancelled = false
    setSession(null)
    setError(null)
    createSession({ chain: target.chain, currency: target.currency, address })
      .then((s) => {
        if (!cancelled) setSession({ id: s.id, clientSecret: s.clientSecret })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      })
    return () => {
      cancelled = true
    }
  }, [isAvailable, address, chainSupported, target.chain, target.currency, createSession])

  const fiatAmount = useMemo(() => {
    const normalized = sanitizeForParsing(sanitizeAmountInput(amount))
    if (!normalized) return null
    const numeric = Number(normalized)
    return Number.isFinite(numeric) ? numeric : null
  }, [amount])
  const amountValid = fiatAmount !== null && fiatAmount >= MIN_AMOUNT
  const amountTooLow = fiatAmount !== null && fiatAmount < MIN_AMOUNT

  const infraReady = isAvailable && chainSupported && Boolean(session) && !error
  const payReady = infraReady && amountValid

  // Resize when a block that changes the modal's height toggles.
  useEffect(() => {
    triggerResize()
  }, [isAvailable, chainSupported, session, error, opened, amountTooLow, triggerResize])

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setPressedPreset(null)
      setAmount(raw)
    }
  }

  const handleAmountBlur = () => {
    const normalized = sanitizeForParsing(sanitizeAmountInput(amount))
    if (!normalized) return
    const numeric = Number(normalized)
    if (Number.isFinite(numeric) && numeric > 0) setAmount(numeric.toFixed(2))
  }

  const handlePreset = (value: number) => {
    setPressedPreset(value)
    setAmount(value.toFixed(2))
  }

  const openExchange = () => {
    if (!session || fiatAmount === null || !amountValid) return
    // Open the tab up-front (sync) so the popup blocker permits it. Passing
    // `noopener` makes window.open return null, leaving the tab stuck on
    // about:blank — keep the handle and sever the opener link manually instead.
    const w = window.open('about:blank', '_blank')
    if (w) w.opener = null
    logger.log('[funding:cex] open pay-link', { sessionId: session.id, amount: fiatAmount, asset: destAssetLabel })
    void payLink({
      sessionId: session.id,
      clientSecret: session.clientSecret,
      amount: String(fiatAmount),
      ...(destAssetLabel ? { asset: destAssetLabel } : {}),
    })
      .then((url) => {
        if (!url) {
          w?.close() // no URL resolved — don't strand the popup on "undefined"
          return
        }
        if (w) w.location.href = url
        else window.location.assign(url) // popup blocked — fall back to this tab
        setOpened(true)
      })
      .catch((e) => {
        w?.close()
        setError(e instanceof Error ? e : new Error(String(e)))
      })
  }

  return (
    <PageContent onBack={routes.DEPOSIT}>
      <ModalHeading>Transfer from Exchange</ModalHeading>

      <Section>
        <SectionLabel>Amount</SectionLabel>
        <AmountCard>
          <CurrencySymbol>$</CurrencySymbol>
          <AmountInput
            value={amount}
            onChange={handleAmountChange}
            onBlur={handleAmountBlur}
            placeholder="0.00"
            inputMode="decimal"
            autoComplete="off"
          />
        </AmountCard>
        <PresetList>
          {PRESETS.map((preset) => (
            <PresetButton
              key={preset}
              type="button"
              $active={pressedPreset === preset}
              onClick={() => handlePreset(preset)}
            >
              ${preset}
            </PresetButton>
          ))}
        </PresetList>
        {amountTooLow ? (
          <span style={errorHelper}>Enter at least ${MIN_AMOUNT}.00 — the Coinbase minimum.</span>
        ) : (
          <span style={helperText}>Minimum ${MIN_AMOUNT}.00</span>
        )}
        {chainSupported && (
          <span style={destinationRow}>
            {destAssetLogo && <img src={destAssetLogo} alt="" style={destinationLogo} onError={hideBrokenLogo} />}
            {destChainLogo && <img src={destChainLogo} alt="" style={destinationLogo} onError={hideBrokenLogo} />}
          </span>
        )}
      </Section>

      {!isAvailable && <ModalBody>Funding isn't available right now.</ModalBody>}
      {isAvailable && !chainSupported && <ModalBody>Coinbase can't deliver to {destChainName} yet.</ModalBody>}
      {error && <ModalBody style={{ color: '#dc2626' }}>{error.message}</ModalBody>}

      <StepDivider>Then open an exchange</StepDivider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {EXCHANGES.map((ex) =>
          ex.comingSoon ? (
            <button
              key={ex.id}
              type="button"
              disabled
              style={{
                ...walletListBtn,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: 0.55,
                cursor: 'not-allowed',
              }}
            >
              <ButtonLogo>{EXCHANGE_LOGO[ex.id]}</ButtonLogo>
              <span>{titleCase(ex.id)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600 }}>Coming soon</span>
            </button>
          ) : (
            <button
              key={ex.id}
              type="button"
              disabled={!payReady}
              style={{
                ...walletListBtn,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: payReady ? 1 : 0.55,
                cursor: payReady ? 'pointer' : 'not-allowed',
              }}
              onClick={openExchange}
            >
              <ButtonLogo>{EXCHANGE_LOGO[ex.id]}</ButtonLogo>
              {infraReady ? `Open ${titleCase(ex.id)} ↗` : 'Preparing…'}
            </button>
          )
        )}
      </div>

      {/* {opened && (
        <ModalBody style={{ marginTop: 12 }}>
          Finish in the Coinbase tab — funds arrive to your wallet automatically. status webhooks
        </ModalBody>
      )} */}
    </PageContent>
  )
}

export default DepositCex

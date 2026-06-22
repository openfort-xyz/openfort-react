'use client'

import { useEffect, useState } from 'react'
import styled from '../../../styles/styled'
import { getPublishableKeyEnvironment } from '../../../utils/validation'
import { useOpenfort } from '../../Openfort/useOpenfort'

/** Relay's own testnet guide — the authoritative explanation of the limitation. */
const RELAY_TESTNET_DOCS = 'https://docs.relay.link/references/api/api_guides/testnet#testnet-support'

const FlaskIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M6 1.5h4M6.5 1.5v4.2L3.3 11.4A1.5 1.5 0 0 0 4.6 13.7h6.8a1.5 1.5 0 0 0 1.3-2.3L9.5 5.7V1.5"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M5.1 9h5.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

const Card = styled.div`
  text-align: left;
  margin-bottom: 14px;
  border-radius: 12px;
  /* Amber "sandbox" tint that reads on both light and dark themes. */
  background: rgba(245, 158, 11, 0.09);
  border: 1px solid rgba(245, 158, 11, 0.28);
  color: var(--ck-body-color);
`

/** The always-visible summary row; the whole row toggles the details. */
const Header = styled.button`
  appearance: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  background: none;
  border: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
`

const Badge = styled.span`
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: #b45309;
  background: rgba(245, 158, 11, 0.18);
`

const Summary = styled.span`
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
`

const Chevron = styled.span<{ $open: boolean }>`
  flex-shrink: 0;
  color: var(--ck-body-color-muted, #6b7280);
  font-size: 11px;
  transition: transform 150ms ease;
  transform: rotate(${({ $open }) => ($open ? '90deg' : '0deg')});
`

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 0 12px 12px 43px;
  font-size: 12.5px;
  line-height: 1.45;
`

const Muted = styled.p`
  margin: 0;
  color: var(--ck-body-color-muted, #6b7280);
`

const Rules = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;

  li {
    display: flex;
    align-items: flex-start;
    gap: 7px;
  }
  li[data-ok='true']::before {
    content: '✓';
    color: #16a34a;
    font-weight: 700;
  }
  li[data-ok='false']::before {
    content: '✕';
    color: #dc2626;
    font-weight: 700;
  }
`

const DocsLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  font-weight: 600;
  color: var(--ck-body-color);
  text-decoration: underline;
  text-underline-offset: 2px;

  &:hover {
    opacity: 0.8;
  }
`

/**
 * A dev-facing notice shown only for test keys (`pk_test_…`) in the Deposit flow.
 *
 * Collapsed by default to a single summary line; expands to explain that funding
 * routes through Relay, whose testnet rail bridges the same asset but cannot swap
 * to a different token (testnets lack DEX liquidity, so e.g. `ETH → USDC` fails),
 * and that card/exchange rails are mainnet-only. Links to Relay's testnet guide.
 * Renders nothing on live keys.
 */
export function TestnetNotice() {
  const { publishableKey, triggerResize } = useOpenfort()
  const [open, setOpen] = useState(false)

  // Re-measure the modal when the details expand/collapse so it grows/shrinks to fit.
  useEffect(() => {
    triggerResize()
  }, [open, triggerResize])

  if (getPublishableKeyEnvironment(publishableKey) !== 'test') return null

  return (
    <Card>
      <Header type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Badge>
          <FlaskIcon />
        </Badge>
        <Summary>Testnet mode — funding is limited</Summary>
        <Chevron $open={open}>▶</Chevron>
      </Header>

      {open && (
        <Body>
          <Muted>
            Deposits route through Relay's testnet rail. It bridges the same asset but can't swap between tokens —
            testnets have no DEX liquidity. Card and exchange rails are mainnet-only.
          </Muted>
          <Rules>
            <li data-ok="true">Bridging the same asset (e.g. ETH → ETH) and same-chain transfers</li>
            <li data-ok="false">Swapping to another token (e.g. → USDC) — fails with "$0 liquidity"</li>
          </Rules>
          <Muted>To test swaps, card or exchange deposits, use a live key on a low-cost chain like Base.</Muted>
          <DocsLink href={RELAY_TESTNET_DOCS} target="_blank" rel="noreferrer">
            Why? Read Relay's testnet guide ↗
          </DocsLink>
        </Body>
      )}
    </Card>
  )
}

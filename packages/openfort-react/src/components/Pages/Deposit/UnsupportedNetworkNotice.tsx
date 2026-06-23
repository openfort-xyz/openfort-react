'use client'

import { chainConfigs } from '../../../constants/chainConfigs'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext'
import type { FundingChain } from '../../../hooks/openfort/useFundingChains'
import styled from '../../../styles/styled'
import { useSwitchChainFiltered } from '../../../wagmi/useSwitchChainFiltered'
import Chain from '../../Common/Chain'
import { ScrollArea } from '../../Common/ScrollArea'
import { isSolana } from './sources'

/** Readable name for a CAIP-2 chain the rail can't deliver to. */
function chainName(caip: string): string {
  if (isSolana(caip)) return 'Solana'
  const id = Number(caip.split(':')[1])
  return chainConfigs.find((c) => c.id === id)?.name ?? 'this network'
}

const Card = styled.div`
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  margin-top: 4px;
  border-radius: 12px;
  background: var(--ck-body-background-secondary, #fafafa);
  border: 1px solid var(--ck-body-divider, #e4e4e7);
  color: var(--ck-body-color);
`

const Title = styled.div`
  font-size: 14px;
  font-weight: 600;
`

const Body = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ck-body-color-muted, #6b7280);
`

const Label = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--ck-body-color-muted, #6b7280);
`

const SwitchButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const SwitchButton = styled.button`
  appearance: none;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--ck-body-divider, #e4e4e7);
  background: var(--ck-body-background, #fff);
  color: var(--ck-body-color);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--ck-secondary-button-hover-background, #f3f3f5);
  }
  &:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .name {
    flex: 1;
    text-align: left;
  }
  .chevron {
    color: var(--ck-body-color-muted, #6b7280);
  }
`

/**
 * Shown in the deposit flow when the active funding TARGET chain (the embedded
 * wallet's chain) isn't one the rail can deliver to — e.g. Polygon Amoy or a
 * Solana testnet, which Relay's testnet rail doesn't route. Explains why, and
 * (on EVM) offers a one-tap switch to the supported chains. Solana-only contexts
 * have no in-VM switch, so they get the explanation alone.
 */
export function UnsupportedNetworkNotice({
  targetChain,
  railChains,
}: {
  targetChain: string
  railChains: FundingChain[]
}) {
  const bridge = useEthereumBridge()
  return (
    <Card>
      <Title>Funding isn't available on {chainName(targetChain)}</Title>
      <Body>
        {isSolana(targetChain)
          ? "Solana isn't supported by the funding rail in test mode. Switch to a supported EVM testnet to add funds."
          : "The funding rail can't deliver to this network. Switch to a supported one to add funds."}
      </Body>
      {bridge && <SupportedChainSwitcher railChains={railChains} />}
    </Card>
  )
}

/**
 * Shown in the deposit flow when funds would settle on the target chain but the active
 * embedded account can't operate there — a smart or delegated account deployed only on
 * other chains. EOAs share one address across EVM chains, so they never hit this.
 * Guides the user to set up an account usable on the target chain.
 */
export function AccountChainNotice({ targetChain }: { targetChain: string }) {
  const name = chainName(targetChain)
  return (
    <Card>
      <Title>Your account isn't available on {name}</Title>
      <Body>
        Deposits settle on {name}, but your active account isn't set up there. Create an EOA, or a smart or delegated
        account on {name}, then deposit again.
      </Body>
    </Card>
  )
}

/**
 * EVM-only: the rail-supported chains the wallet can switch to. Rendered only when
 * an Ethereum bridge is present (wagmi), so the wagmi hook below never runs in a
 * Solana-only provider tree.
 */
function SupportedChainSwitcher({ railChains }: { railChains: FundingChain[] }) {
  const { chains, switchChain, isPending } = useSwitchChainFiltered()
  const supported = chains.filter((c) => railChains.some((rc) => rc.id === `eip155:${c.id}`))
  if (supported.length === 0) return null

  return (
    <>
      <Label>Switch to a supported network</Label>
      <ScrollArea height={156}>
        <SwitchButtons>
          {supported.map((c) => {
            return (
              <SwitchButton
                key={c.id}
                type="button"
                disabled={isPending || !switchChain}
                onClick={() => switchChain?.({ chainId: c.id })}
              >
                <Chain id={c.id} size={22} />
                <span className="name">{c.name}</span>
                <span className="chevron" aria-hidden>
                  ›
                </span>
              </SwitchButton>
            )
          })}
        </SwitchButtons>
      </ScrollArea>
    </>
  )
}

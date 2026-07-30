'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { type Address, type EIP1193Provider, encodeFunctionData, erc20Abi, formatUnits, parseUnits } from 'viem'
import { WalletIcon } from '../../../assets/icons.js'
import logos from '../../../assets/logos.js'
import { ProviderNotFoundError } from '../../../errors/connection.js'
import { WalletNotConnectedError } from '../../../errors/wallet.js'
import {
  type OpenfortEthereumBridgeConnector,
  useEthereumBridge,
} from '../../../ethereum/OpenfortEthereumBridgeContext.js'
import type { FundingChain, FundingCurrency } from '../../../hooks/openfort/useFundingChains.js'
import { ModalBody } from '../../Common/Modal/styles.js'
import { ScrollArea } from '../../Common/ScrollArea/index.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { DepositStatus } from '../Deposit/DepositStatus.js'
import { walletListBtn } from '../Deposit/formStyles.js'
import { ButtonLogo } from '../Deposit/styles.js'
import { caipToChainId } from './walletDeeplinks.js'

/** Hardcoded brand logo for a connector, matched by id/name; falls back to its own icon, then a generic. */
function brandLogo(connector: { id: string; name: string; icon?: string }): ReactNode {
  const k = `${connector.id} ${connector.name}`.toLowerCase()
  if (k.includes('metamask')) return <logos.MetaMask background />
  if (k.includes('rabby')) return <logos.Rabby />
  if (k.includes('coinbase')) return <logos.Coinbase background />
  if (k.includes('phantom')) return <logos.Phantom background />
  if (k.includes('trust')) return <logos.Trust />
  if (k.includes('rainbow')) return <logos.Rainbow round />
  if (connector.icon) return <img src={connector.icon} alt="" width={20} height={20} style={{ borderRadius: 6 }} />
  return <WalletIcon />
}

type Props = {
  /** Relay deposit address the source funds are sent to. */
  receiverAddress: string | null
  activeChain: FundingChain | undefined
  activeCurrency: FundingCurrency | undefined
  loading: boolean
  /** Amount to send, in the source token's units. Owned by the parent so the
   * amount input + presets are shared with the mobile (deeplink) path. */
  amount: string
}

/** Readable message from a wallet/provider error; null for a user rejection (4001). */
function walletErrorMessage(e: unknown): string | null {
  if (e && typeof e === 'object') {
    const o = e as { code?: number; shortMessage?: string; message?: string; details?: string }
    if (o.code === 4001) return null // user rejected — nothing to flag
    return o.shortMessage || o.message || o.details || 'Transaction failed'
  }
  return typeof e === 'string' ? e : 'Transaction failed'
}

/**
 * Desktop "transfer from wallet": send the source token to the Relay deposit
 * address straight from the user's EXTERNAL browser-extension wallet
 * (MetaMask/Rabby/…), via that connector's own provider — never the active
 * Openfort embedded account (that one is the destination, not the source).
 * Once the deposit lands, the funding session's status polling drives progress.
 */
export function DepositWalletDesktop({ receiverAddress, activeChain, activeCurrency, loading, amount }: Props) {
  const bridge = useEthereumBridge()
  const { triggerResize } = useOpenfort()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // Grow the modal when the busy / error / sent feedback toggles, so the "Confirm
  // in your wallet…" and insufficient-balance messages are revealed instead of
  // clipped below the fold (which reads as "nothing happened" after a click).
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are re-measure triggers, not inputs
  useEffect(() => {
    triggerResize()
  }, [busyId, error, sent, triggerResize])

  if (!bridge) return null // EVM-only (no wagmi) — nothing to send through

  // bridge.connectors already excludes the Openfort embedded connector, so these
  // are the user's external wallets. Drop WalletConnect: its provider needs a
  // connect()/session flow our direct request() path doesn't support.
  const connectors = bridge.connectors.filter((c) => !c.id.toLowerCase().includes('walletconnect'))
  const srcChainId = caipToChainId(activeChain?.id)
  const amountValid = Number.parseFloat(amount) > 0

  const sendVia = async (c: OpenfortEthereumBridgeConnector) => {
    if (!receiverAddress || !activeCurrency || !srcChainId || !amountValid) return
    setBusyId(c.id)
    setError(null)
    setSent(false)
    try {
      const provider = (await c.getProvider?.()) as EIP1193Provider | undefined
      if (!provider) throw new ProviderNotFoundError('Wallet provider unavailable.')

      const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
      const from = accounts?.[0] as Address | undefined
      if (!from) throw new WalletNotConnectedError('No account in wallet.')

      // Ask the wallet to switch to the source chain (ignored if already there).
      await provider
        .request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${srcChainId.toString(16)}` }] })
        .catch(() => {})

      const value = parseUnits(amount, activeCurrency.decimals)
      const to = receiverAddress as Address

      // Guard: confirm the wallet holds enough on this chain. Otherwise the transfer
      // just reverts (wasted gas) and the deposit never arrives — the bug we hit.
      const balance = activeCurrency.native
        ? BigInt((await provider.request({ method: 'eth_getBalance', params: [from, 'latest'] })) as string)
        : BigInt(
            ((await provider.request({
              method: 'eth_call',
              params: [
                { to: activeCurrency.address as Address, data: `0x70a08231${from.slice(2).padStart(64, '0')}` },
                'latest',
              ],
            })) as string) || '0x0'
          )
      if (balance < value) {
        setError(
          `Not enough ${activeCurrency.symbol} on ${activeChain?.name ?? 'this chain'} — you have ${formatUnits(balance, activeCurrency.decimals)}.`
        )
        return
      }

      if (activeCurrency.native) {
        await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from, to, value: `0x${value.toString(16)}` }],
        })
      } else {
        const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, value] })
        await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from, to: activeCurrency.address as Address, data }],
        })
      }
      setSent(true)
    } catch (e) {
      setError(walletErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 auto', minHeight: 0 }}>
      {connectors.length === 0 && <ModalBody>No browser wallet detected. Install MetaMask or Rabby.</ModalBody>}

      {connectors.length > 0 && (
        <ScrollArea fill>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {connectors.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!amountValid || busyId !== null || loading}
                style={{
                  ...walletListBtn,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 10,
                  opacity: !amountValid || busyId !== null ? 0.55 : 1,
                }}
                onClick={() => sendVia(c)}
              >
                <ButtonLogo>{brandLogo(c)}</ButtonLogo>
                <span>{busyId === c.id ? 'Confirm in your wallet…' : `Send via ${c.name}`}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {sent && <DepositStatus status="waiting_payment" />}
      {error && <ModalBody style={{ color: '#dc2626' }}>{error}</ModalBody>}
    </div>
  )
}

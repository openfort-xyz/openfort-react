'use client'

import type { SyntheticEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useFunding } from '../../../hooks/openfort/useFunding'
import { CopyIconButton } from '../../Common/CopyToClipboard/CopyIconButton'
import CustomQRCode from '../../Common/CustomQRCode'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AssetChainLogo } from '../Deposit/AssetChainLogo'
import { DepositDetails } from '../Deposit/Details'
import {
  addressBox,
  bareSelect,
  codeStyle,
  deeplinkBtn,
  deeplinkRow,
  field,
  logoImg,
  selectWrap,
  twoCol,
  walletListBtn,
} from '../Deposit/formStyles'
import { OrDivider } from '../Deposit/OrDivider'
import {
  addressFor,
  chainLogo,
  DEST_CHAIN,
  DEST_USDC,
  isSolana,
  NOMINAL_UNITS,
  SOURCE_CHAINS,
  tokenLogo,
  tokensFor,
} from '../Deposit/sources'
import { QRWrapper } from '../Deposit/styles'

const hideBrokenLogo = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.style.display = 'none'
}

/**
 * Transfer crypto — choose a source chain + token; the deposit address + QR
 * appear automatically. "Transfer crypto from wallet" opens a one-column list of
 * wallet open-dApp links. Same-chain is a plain transfer to the wallet.
 */
const DepositCrypto = () => {
  const wallet = useEthereumEmbeddedWallet()
  const { triggerResize } = useOpenfort()
  const { session, error, loading, isAvailable, fund, reset } = useFunding()
  const address = wallet.status === 'connected' ? wallet.address : undefined
  const firstChain = SOURCE_CHAINS[0]?.id ?? DEST_CHAIN
  const [chain, setChain] = useState(firstChain)
  const [token, setToken] = useState(tokensFor(firstChain)[0]?.symbol ?? 'USDC')
  const [walletsOpen, setWalletsOpen] = useState(false)
  const pm = session?.paymentMethod ?? null
  const lastKey = useRef('')

  const tokens = tokensFor(chain)
  const activeToken = tokens.some((t) => t.symbol === token) ? token : (tokens[0]?.symbol ?? 'USDC')
  const sameChain = chain === DEST_CHAIN
  const receiverAddress = sameChain ? address : (pm?.receiverAddress ?? null)

  useEffect(() => {
    if (!address || !isAvailable) return
    if (sameChain) {
      lastKey.current = ''
      reset()
      return
    }
    const key = `${chain}:${activeToken}`
    if (lastKey.current === key) return
    lastKey.current = key
    fund(
      { chain: DEST_CHAIN, currency: DEST_USDC, address },
      {
        type: isSolana(chain) ? 'solana' : 'evm',
        source: { chain, currency: addressFor(chain, activeToken), amount: NOMINAL_UNITS },
      }
    ).catch(() => {})
  }, [address, chain, activeToken, isAvailable, sameChain, fund, reset])

  useEffect(() => {
    triggerResize()
  }, [receiverAddress, loading, walletsOpen, triggerResize])

  // Sub-page: one-column wallet list.
  if (walletsOpen) {
    return (
      <PageContent onBack={() => setWalletsOpen(false)}>
        <ModalHeading>Transfer crypto from wallet</ModalHeading>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {(pm?.deeplinks ?? []).map((d) => (
            <a key={d.app} href={d.url} target="_blank" rel="noreferrer" style={walletListBtn}>
              {d.label} ↗
            </a>
          ))}
        </div>
      </PageContent>
    )
  }

  return (
    <PageContent onBack={routes.DEPOSIT}>
      <ModalHeading>Transfer crypto</ModalHeading>

      <div style={twoCol}>
        <label style={field}>
          Supported chain
          <div style={selectWrap}>
            <img src={chainLogo(chain)} alt="" style={logoImg} onError={hideBrokenLogo} />
            <select style={bareSelect} value={chain} onChange={(e) => setChain(e.target.value)}>
              {SOURCE_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label style={field}>
          Supported token
          <div style={selectWrap}>
            <img src={tokenLogo(chain, activeToken)} alt="" style={logoImg} onError={hideBrokenLogo} />
            <select style={bareSelect} value={activeToken} onChange={(e) => setToken(e.target.value)}>
              {tokens.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {!isAvailable && <ModalBody>Set uiConfig.fundingBaseUrl to enable transfers.</ModalBody>}
      {loading && !sameChain && !pm && <ModalBody style={{ marginTop: 12 }}>Fetching deposit address…</ModalBody>}

      {receiverAddress && (
        <>
          <QRWrapper>
            <CustomQRCode
              value={receiverAddress}
              image={<AssetChainLogo assetLogo={tokenLogo(chain, activeToken)} chainLogo={chainLogo(chain)} />}
              imageBackground="#fff"
            />
          </QRWrapper>
          <div style={addressBox}>
            <code style={codeStyle}>{receiverAddress}</code>
            <CopyIconButton value={receiverAddress} />
          </div>
          {!sameChain && pm && <DepositDetails pm={pm} />}
          {!sameChain && pm && pm.deeplinks.length > 0 && (
            <>
              <OrDivider />
              <div style={deeplinkRow}>
                <button type="button" style={deeplinkBtn} onClick={() => setWalletsOpen(true)}>
                  Transfer crypto from wallet ›
                </button>
              </div>
            </>
          )}
        </>
      )}
      {error && <ModalBody style={{ color: '#dc2626', marginTop: 12 }}>{error.message}</ModalBody>}
    </PageContent>
  )
}

export default DepositCrypto

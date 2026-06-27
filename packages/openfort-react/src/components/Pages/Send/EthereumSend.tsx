'use client'

/**
 * Ethereum Send page
 *
 * EVM asset send form (ERC-20 and native ETH).
 */

import { useEffect, useMemo } from 'react'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { chainLogoUrl, currencyLogoUrl } from '../../../constants/logos'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets'
import Button from '../../Common/Button'
import { Arrow, ArrowChevron } from '../../Common/Button/styles'
import { ModalHeading } from '../../Common/Modal/styles'
import { type Asset, routes, type SendFormState } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AssetChainLogo } from '../Deposit/AssetChainLogo'
import {
  AmountField,
  AmountMeta,
  AmountRow,
  BalanceMeta,
  CardLabel,
  ErrorText,
  Form,
  MetaText,
  PasteButton,
  PillLogo,
  RecipientInput,
  SendCard,
  TokenPill,
  ToRow,
  UseMaxButton,
} from './styles'
import { formatBalance, isSameToken, sanitizeAmountInput, sanitizeForParsing } from './utils'

export const EthereumSend = () => {
  const { sendForm, setSendForm, setRoute, triggerResize } = useOpenfort()

  // Size the modal to the form on mount. Without this the screen isn't anchored
  // and scrolls within the modal — every other Page triggers a resize on mount.
  useEffect(() => {
    triggerResize()
  }, [triggerResize])

  const { data: assets } = useEthereumWalletAssets()
  const { chainId } = useEthereumEmbeddedWallet()

  const matchedToken = useMemo(
    () => assets?.find((asset) => isSameToken(asset, sendForm.asset)),
    [assets, sendForm.asset]
  )

  const selectedTokenOption = matchedToken ?? assets?.[0]
  const selectedToken: Asset = selectedTokenOption ?? sendForm.asset
  const selectedBalanceValue = selectedTokenOption?.balance
  const selectedDecimalsValue = selectedToken.type === 'erc20' ? (selectedToken.metadata?.decimals ?? 18) : 18
  const selectedSymbol = selectedToken.metadata?.symbol ?? ''

  const parsedAmount = useMemo(() => {
    const rawAmount = sanitizeForParsing(sendForm.amount)
    if (!rawAmount) return null
    try {
      return parseUnits(rawAmount, selectedDecimalsValue)
    } catch (_error) {
      return null
    }
  }, [sendForm.amount, selectedDecimalsValue])

  const recipientValid = isAddress(sendForm.recipient)
  const insufficientBalance =
    parsedAmount !== null && selectedBalanceValue !== undefined ? parsedAmount > selectedBalanceValue : false
  const hasAmount = parsedAmount !== null && parsedAmount > BigInt(0)
  const amountValid = hasAmount && !insufficientBalance

  const canProceed = recipientValid && amountValid

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canProceed) return
    const normalized = sanitizeForParsing(sendForm.amount)
    if (!normalized) return
    setSendForm((prev: SendFormState) => ({
      ...prev,
      amount: normalized,
      asset: prev.asset,
    }))
    setRoute(routes.SEND_CONFIRMATION)
  }

  const handleRecipientChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSendForm((prev) => ({
      ...prev,
      recipient: event.target.value,
    }))
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setSendForm((prev) => ({ ...prev, recipient: text.trim() }))
    } catch {
      // Clipboard unavailable or permission denied — leave the field as-is.
    }
  }

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setSendForm((prev) => ({
        ...prev,
        amount: raw,
      }))
    }
  }

  const handleMax = () => {
    if (!selectedBalanceValue) return
    const maxAmount = formatUnits(selectedBalanceValue, selectedDecimalsValue)
    setSendForm((prev) => ({
      ...prev,
      amount: maxAmount,
    }))
  }

  const handleOpenTokenSelector = () => {
    setRoute(routes.SEND_TOKEN_SELECT)
  }

  const availableLabel = formatBalance(selectedBalanceValue, selectedDecimalsValue)
  const maxDisabled = !selectedBalanceValue

  const fiatValue = useMemo(() => {
    const perToken = selectedToken.metadata?.fiat?.value
    const n = Number(sanitizeForParsing(sendForm.amount))
    if (!perToken || !Number.isFinite(n) || n <= 0) return null
    return `$${(n * perToken).toFixed(2)}`
  }, [selectedToken.metadata, sendForm.amount])

  return (
    <PageContent onBack={routes.CONNECTED}>
      <ModalHeading>Send money</ModalHeading>
      <Form onSubmit={handleSubmit}>
        <SendCard>
          <ToRow>
            <CardLabel>To</CardLabel>
            <RecipientInput
              placeholder="0x… or address"
              value={sendForm.recipient}
              onChange={handleRecipientChange}
              autoComplete="off"
              spellCheck={false}
            />
            <PasteButton type="button" onClick={handlePaste}>
              Paste
            </PasteButton>
          </ToRow>
          {sendForm.recipient && !recipientValid && <ErrorText>Enter a valid wallet address.</ErrorText>}
        </SendCard>

        <SendCard>
          <CardLabel>Amount</CardLabel>
          <AmountRow>
            <AmountField
              placeholder="0"
              value={sendForm.amount}
              onChange={handleAmountChange}
              inputMode="decimal"
              autoComplete="off"
            />
            <TokenPill type="button" onClick={handleOpenTokenSelector}>
              {selectedSymbol && (
                <PillLogo>
                  <AssetChainLogo
                    assetLogo={currencyLogoUrl(selectedSymbol) ?? ''}
                    chainLogo={chainLogoUrl(chainId) ?? ''}
                    symbol={selectedSymbol}
                  />
                </PillLogo>
              )}
              {selectedSymbol || 'Select'}
              <Arrow width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ArrowChevron
                  stroke="currentColor"
                  d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Arrow>
            </TokenPill>
          </AmountRow>
          <AmountMeta>
            <MetaText style={{ flex: 1, minWidth: 0 }}>{fiatValue ?? ''}</MetaText>
            <BalanceMeta>
              <MetaText>{availableLabel === '--' ? '--' : `${availableLabel} ${selectedSymbol}`}</MetaText>
              <UseMaxButton type="button" onClick={handleMax} disabled={maxDisabled}>
                Use max
              </UseMaxButton>
            </BalanceMeta>
          </AmountMeta>
          {sendForm.amount && parsedAmount === null && <ErrorText>Enter a valid amount.</ErrorText>}
          {insufficientBalance && <ErrorText>Insufficient balance for this transfer.</ErrorText>}
        </SendCard>

        <Button variant="primary" disabled={!canProceed}>
          Review transfer
        </Button>
      </Form>
    </PageContent>
  )
}

'use client'

/**
 * Solana Send page
 *
 * Native SOL transfer form. Single fixed asset (SOL) — no token picker. Mirrors
 * EthereumSend's validation/Max behaviour; the actual transfer happens on the
 * SolanaSendConfirmation page.
 */

import { useMemo } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { fetchSolanaBalance } from '../../../hooks/useBalance'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Button from '../../Common/Button'
import Input from '../../Common/Input'
import { ModalHeading } from '../../Common/Modal/styles'
import { routes, type SendFormState } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { AmountInputWrapper, ErrorText, Field, FieldLabel, Form, HelperText, MaxButton } from './styles'
import { formatBalance, sanitizeAmountInput, sanitizeForParsing } from './utils'

const SOL_DECIMALS = 9

/** Cheap base58 shape check for the form; the RPC validates the real address on send. */
function isLikelySolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
}

export const SolanaSend = () => {
  const { sendForm, setSendForm, setRoute } = useOpenfort()
  const wallet = useSolanaEmbeddedWallet()
  const address = wallet.status === 'connected' ? wallet.address : undefined
  const rpcUrl = wallet.rpcUrl

  const balanceResult = useAsyncData({
    queryKey: ['solana-balance', address, rpcUrl],
    queryFn: async () => {
      if (!address || !rpcUrl) return null
      const { value } = await fetchSolanaBalance(address, rpcUrl, 'confirmed')
      return value
    },
    enabled: Boolean(address && rpcUrl),
  })
  const balanceLamports = balanceResult.data ?? undefined

  const parsedAmount = useMemo(() => {
    const raw = sanitizeForParsing(sendForm.amount)
    if (!raw) return null
    try {
      return parseUnits(raw, SOL_DECIMALS)
    } catch {
      return null
    }
  }, [sendForm.amount])

  const recipientValid = isLikelySolanaAddress(sendForm.recipient.trim())
  const insufficientBalance =
    parsedAmount !== null && balanceLamports !== undefined ? parsedAmount > balanceLamports : false
  const amountValid = parsedAmount !== null && parsedAmount > BigInt(0) && !insufficientBalance
  const canProceed = recipientValid && amountValid

  const availableLabel = formatBalance(balanceLamports, SOL_DECIMALS)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canProceed) return
    const normalized = sanitizeForParsing(sendForm.amount)
    if (!normalized) return
    setSendForm((prev: SendFormState) => ({
      ...prev,
      recipient: prev.recipient.trim(),
      amount: normalized,
      asset: {
        type: 'native',
        balance: balanceLamports ?? BigInt(0),
        metadata: { symbol: 'SOL', decimals: SOL_DECIMALS, fiat: { value: 0, currency: 'USD' } },
      },
    }))
    setRoute(routes.SOL_SEND_CONFIRMATION)
  }

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setSendForm((prev) => ({ ...prev, amount: raw }))
    }
  }

  const handleMax = () => {
    if (balanceLamports === undefined) return
    setSendForm((prev) => ({ ...prev, amount: formatUnits(balanceLamports, SOL_DECIMALS) }))
  }

  return (
    <PageContent onBack={routes.SOL_CONNECTED}>
      <ModalHeading>Send SOL</ModalHeading>
      <Form onSubmit={handleSubmit}>
        <Field>
          <FieldLabel>Amount</FieldLabel>
          <AmountInputWrapper>
            <Input
              placeholder="0.00"
              value={sendForm.amount}
              onChange={handleAmountChange}
              inputMode="decimal"
              autoComplete="off"
              style={{ paddingRight: '86px' }}
            />
            <MaxButton type="button" onClick={handleMax} disabled={balanceLamports === undefined}>
              Max
            </MaxButton>
          </AmountInputWrapper>
          <HelperText>Available: {availableLabel} SOL</HelperText>
          {sendForm.amount && parsedAmount === null && <ErrorText>Enter a valid amount.</ErrorText>}
          {insufficientBalance && <ErrorText>Insufficient SOL balance for this transfer.</ErrorText>}
        </Field>

        <Field>
          <FieldLabel>Recipient address</FieldLabel>
          <Input
            placeholder="Solana address"
            value={sendForm.recipient}
            onChange={(e) => setSendForm((prev) => ({ ...prev, recipient: e.target.value }))}
            autoComplete="off"
          />
          {sendForm.recipient && !recipientValid && <ErrorText>Enter a valid Solana address.</ErrorText>}
        </Field>

        <Button variant="primary" disabled={!canProceed}>
          Review transfer
        </Button>
      </Form>
    </PageContent>
  )
}

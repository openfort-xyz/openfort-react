'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useRef, useState } from 'react'
import { asOpenfortError } from '../../../errors/base.js'
import { UnsupportedOperationError } from '../../../errors/operation.js'
import { WalletError, WalletNotConnectedError } from '../../../errors/wallet.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { assertEmbeddedEthereumAccount } from '../../../shared/utils/assertEmbeddedEthereumAccount.js'
import { runEmbeddedSignerOperation } from '../../../shared/utils/embeddedSignerOperationQueue.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import Button from '../../Common/Button/index.js'
import { CopyButton } from '../../Common/CopyToClipboard/CopyButton.js'
import type { SignRequest } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import {
  CopyRow,
  DataItem,
  DataKey,
  DataList,
  ErrorText,
  Footer,
  MessageBox,
  SignaturePreview,
  SignContent,
  Subtitle,
  SuccessCircle,
  SuccessTitle,
  SuccessWrap,
} from './styles.js'

/** Renders an EIP-712 value as a readable nested bullet list. */
function DataNode({ value }: { value: unknown }) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return (
      <DataList>
        {Object.entries(value as Record<string, unknown>).map(([key, child]) => (
          <DataItem key={key}>
            <DataKey>{key}:</DataKey>{' '}
            {child !== null && typeof child === 'object' ? <DataNode value={child} /> : String(child)}
          </DataItem>
        ))}
      </DataList>
    )
  }
  return <>{String(value)}</>
}

/** Normalises an EIP-712 `domain.chainId`, which arrives as a number, bigint or string. */
function toChainId(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const SignMessage = () => {
  const { signRequest, setSignRequest, setOpen, uiConfig, triggerResize } = useOpenfort()
  const chainType = useOpenfortCore((s) => s.chainType)
  const client = useOpenfortCore((s) => s.client)
  const wallet = useEthereumEmbeddedWallet()
  const solana = useSolanaEmbeddedWallet()
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const mountedRef = useRef(false)
  const activeRequestRef = useRef<SignRequest | null>(null)
  const settledRequestsRef = useRef(new WeakSet<SignRequest>())
  const walletReady = chainType === ChainTypeEnum.SVM ? solana.status === 'connected' : wallet.status === 'connected'

  useEffect(() => {
    if (activeRequestRef.current && activeRequestRef.current !== signRequest) {
      setSigning(false)
      setError(null)
      setSignature(null)
    }
    mountedRef.current = true
    activeRequestRef.current = signRequest
    const request = signRequest

    return () => {
      mountedRef.current = false
      queueMicrotask(() => {
        const requestWasReplaced = mountedRef.current && activeRequestRef.current !== request
        const screenUnmounted = !mountedRef.current && activeRequestRef.current === request
        if (!request || settledRequestsRef.current.has(request) || (!requestWasReplaced && !screenUnmounted)) return

        settledRequestsRef.current.add(request)
        request.settle({ error: new WalletError('Signature request was cancelled.') })
        setSignRequest((current) => (current === request ? null : current))
      })
    }
  }, [signRequest, setSignRequest])

  // Content height changes between the views; re-measure.
  useEffect(() => {
    triggerResize()
  }, [triggerResize])

  if (!signRequest) return null

  const appName = uiConfig.appName ?? 'This app'

  const close = () => {
    setSignRequest(null)
    setOpen(false)
  }

  const handleSign = async () => {
    const request = signRequest
    setError(null)
    setSigning(true)
    try {
      let signed: string
      if (chainType === ChainTypeEnum.SVM) {
        if (request.kind !== 'message')
          throw new UnsupportedOperationError({ operation: 'Typed data signing on Solana' })
        if (solana.status !== 'connected') throw new WalletNotConnectedError('No connected wallet to sign with.')
        signed = await solana.provider.signMessage(request.message)
      } else {
        if (wallet.status !== 'connected') throw new WalletNotConnectedError('No connected wallet to sign with.')
        const intendedAddress = wallet.address
        signed = await runEmbeddedSignerOperation(client, async ({ assertCurrent }) => {
          const provider = await client.embeddedWallet.getEthereumProvider({ announceProvider: false })
          assertCurrent()
          // The typed-data domain names the chain the signature is valid on, so
          // signing it while connected elsewhere produces a signature that is
          // good on a chain the user is not on. Grant and revoke already pin the
          // chain this way.
          // viem types `domain.chainId` as `number | bigint`, and the payload
          // arrives as `Record<string, unknown>`, so hex and decimal strings
          // show up too. Matching only `number` skipped every one of them —
          // the cases the check exists for.
          const intendedChainId =
            request.kind === 'typedData' ? toChainId(request.typedData.domain?.chainId) : undefined
          await assertEmbeddedEthereumAccount(provider, intendedAddress, intendedChainId)
          assertCurrent()
          return request.kind === 'message'
            ? client.embeddedWallet.signMessage(request.message)
            : client.embeddedWallet.signTypedData(
                request.typedData.domain ?? {},
                request.typedData.types,
                request.typedData.message
              )
        })
      }

      if (!mountedRef.current || activeRequestRef.current !== request || settledRequestsRef.current.has(request)) return
      settledRequestsRef.current.add(request)
      request.settle({ signature: signed })
      setSignature(signed)
      setSigning(false)
      triggerResize()
    } catch (cause) {
      if (!mountedRef.current || activeRequestRef.current !== request || settledRequestsRef.current.has(request)) return
      const error = asOpenfortError(
        cause,
        (wrappedCause) => new WalletError('Failed to sign the message.', { cause: wrappedCause })
      )
      settledRequestsRef.current.add(request)
      request.settle({ error })
      setError(error.shortMessage)
      setSigning(false)
      setSignRequest((current) => (current === request ? null : current))
      setOpen(false)
    }
  }

  if (signature) {
    return (
      <PageContent onBack={null}>
        <SuccessWrap>
          <SuccessCircle>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </SuccessCircle>
          <SuccessTitle>Message signed</SuccessTitle>
          <SignaturePreview>{`${signature.slice(0, 14)}…${signature.slice(-12)}`}</SignaturePreview>
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        </SuccessWrap>
      </PageContent>
    )
  }

  return (
    <PageContent onBack={null}>
      <SignContent>
        <Subtitle>{appName} wants you to sign a message. It will not cost you any fees.</Subtitle>

        {signRequest.kind === 'message' ? (
          <MessageBox>{signRequest.message}</MessageBox>
        ) : (
          <MessageBox>
            <DataNode
              value={{
                domain: signRequest.typedData.domain,
                primaryType: signRequest.typedData.primaryType,
                message: signRequest.typedData.message,
              }}
            />
          </MessageBox>
        )}

        <Footer>
          {signRequest.kind === 'typedData' && (
            <CopyRow>
              <CopyButton value={JSON.stringify(signRequest.typedData, null, 2)}>Copy to clipboard</CopyButton>
            </CopyRow>
          )}
          {error && <ErrorText>{error}</ErrorText>}
          <Button
            variant="primary"
            onClick={handleSign}
            waiting={signing || !walletReady}
            disabled={signing || !walletReady}
            arrow
          >
            Sign and continue
          </Button>
        </Footer>
      </SignContent>
    </PageContent>
  )
}

export default SignMessage

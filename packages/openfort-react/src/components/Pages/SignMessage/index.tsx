'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useRef, useState } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import Button from '../../Common/Button/index.js'
import { CopyButton } from '../../Common/CopyToClipboard/CopyButton.js'
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

const SignMessage = () => {
  const { signRequest, setSignRequest, setOpen, uiConfig, triggerResize } = useOpenfort()
  const { chainType } = useOpenfortCore()
  const wallet = useEthereumEmbeddedWallet()
  const solana = useSolanaEmbeddedWallet()
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const settledRef = useRef(false)
  const mountedRef = useRef(false)

  // Reject the pending request if the screen unmounts before signing (the user
  // closed the modal or navigated away). React StrictMode invokes effect cleanup
  // on a dev-only synchronous remount, so defer the reject to a microtask: the
  // immediate remount flips mountedRef back to true and cancels the spurious
  // "User rejected" that would otherwise fire while the wallet UI is still open.
  useEffect(() => {
    mountedRef.current = true
    const request = signRequest
    return () => {
      mountedRef.current = false
      queueMicrotask(() => {
        if (!mountedRef.current && !settledRef.current) {
          request?.reject(new Error('User rejected the signature request'))
        }
      })
    }
  }, [signRequest])

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
    setError(null)
    setSigning(true)
    try {
      let signed: string
      if (chainType === ChainTypeEnum.SVM) {
        if (signRequest.kind !== 'message') throw new Error('Typed data signing is not supported on Solana.')
        if (solana.status !== 'connected') throw new Error('No connected wallet to sign with')
        signed = await solana.provider.signMessage(signRequest.message)
      } else {
        const provider = await wallet.activeWallet?.getProvider()
        if (!provider) throw new Error('No connected wallet to sign with')

        // Use the address the provider will actually sign with as `from`. The core
        // SDK resolves the signing account from storage, which can diverge from the
        // hook's activeWallet.address when the user has multiple smart accounts.
        // A stale `from` makes personal_sign reject with
        // "personal_sign requires the signer to be the from address".
        const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
        const address = accounts?.[0] ?? wallet.address
        if (!address) throw new Error('No connected wallet to sign with')

        signed = (
          signRequest.kind === 'message'
            ? await provider.request({ method: 'personal_sign', params: [signRequest.message, address] })
            : await provider.request({
                method: 'eth_signTypedData_v4',
                params: [address, JSON.stringify(signRequest.typedData)],
              })
        ) as string
      }

      settledRef.current = true
      signRequest.resolve(signed)
      setSignature(signed)
      setSigning(false)
      triggerResize()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign the message')
      setSigning(false)
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
          <Button variant="primary" onClick={handleSign} waiting={signing} disabled={signing} arrow>
            Sign and continue
          </Button>
        </Footer>
      </SignContent>
    </PageContent>
  )
}

export default SignMessage

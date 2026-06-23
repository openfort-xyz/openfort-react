'use client'

import { useEffect, useRef, useState } from 'react'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import Button from '../../Common/Button'
import { CopyButton } from '../../Common/CopyToClipboard/CopyButton'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { CopyRow, DataItem, DataKey, DataList, ErrorText, MessageBox, SignContent, Subtitle } from './styles'

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
  const wallet = useEthereumEmbeddedWallet()
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const settledRef = useRef(false)

  // Reject the pending request if the screen unmounts before signing (the user
  // closed the modal or navigated away).
  useEffect(() => {
    return () => {
      if (!settledRef.current) signRequest?.reject(new Error('User rejected the signature request'))
    }
  }, [signRequest])

  // Content height changes between the message and typed-data views; re-measure.
  useEffect(() => {
    triggerResize()
  }, [triggerResize])

  if (!signRequest) return null

  const appName = uiConfig.appName ?? 'This app'

  const handleSign = async () => {
    setError(null)
    setSigning(true)
    try {
      const provider = await wallet.activeWallet?.getProvider()
      const address = wallet.address
      if (!provider || !address) throw new Error('No connected wallet to sign with')

      const signature = (
        signRequest.kind === 'message'
          ? await provider.request({ method: 'personal_sign', params: [signRequest.message, address] })
          : await provider.request({
              method: 'eth_signTypedData_v4',
              params: [address, JSON.stringify(signRequest.typedData)],
            })
      ) as `0x${string}`

      settledRef.current = true
      signRequest.resolve(signature)
      setSignRequest(null)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign the message')
      setSigning(false)
    }
  }

  return (
    <PageContent onBack={null}>
      <SignContent>
        <Subtitle>{appName} wants you to sign a message. It will not cost you any fees.</Subtitle>

        {signRequest.kind === 'message' ? (
          <MessageBox>{signRequest.message}</MessageBox>
        ) : (
          <>
            <MessageBox $scroll>
              <DataNode
                value={{
                  domain: signRequest.typedData.domain,
                  primaryType: signRequest.typedData.primaryType,
                  message: signRequest.typedData.message,
                }}
              />
            </MessageBox>
            <CopyRow>
              <CopyButton value={JSON.stringify(signRequest.typedData, null, 2)}>Copy to clipboard</CopyButton>
            </CopyRow>
          </>
        )}

        {error && <ErrorText>{error}</ErrorText>}

        <Button variant="primary" onClick={handleSign} waiting={signing} disabled={signing} arrow>
          Sign and continue
        </Button>
      </SignContent>
    </PageContent>
  )
}

export default SignMessage

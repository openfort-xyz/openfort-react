import type { SignTypedDataPayload } from '@openfort/react'
import { useSignMessage as useOpenfortSignMessage, useUI } from '@openfort/react'
import { useState } from 'react'
import { useChainId } from 'wagmi'
import { FundingCountryPresets } from '@/components/FundingScenarios'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { useDisplayEthereumAddress } from '@/hooks/useConnectedEthereumAccount'
import { toError } from '@/lib/errors'

/**
 * The prebuilt-modal half of each action card. Every one of these is a
 * `useUI().open*` call — the same action the headless variant performs by hand,
 * handed off to Openfort's own screens instead.
 */

/** EIP-712 sample for the typed-data screen. `domain.chainId` has to match the active
 *  chain or the embedded wallet rejects it, so it's filled in at call time. */
const sampleTypedData = (chainId: number): SignTypedDataPayload => ({
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  message: {
    from: { name: 'Cow', wallet: '0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826' },
    to: { name: 'Bob', wallet: '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB' },
    contents: 'Hello, Bob! This is a longer typed-data payload so the sign screen has to scroll on mobile.',
  },
})

/** Signing through the SDK's confirmation screen rather than a raw wallet call. */
export const SignWidget = () => {
  const { signMessage, signTypedData, isPending } = useOpenfortSignMessage()
  const address = useDisplayEthereumAddress()
  const chainId = useChainId()
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const run = async (fn: () => Promise<string>) => {
    setError(null)
    setSignature(null)
    try {
      setSignature(await fn())
    } catch (err) {
      setError(toError(err))
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          disabled={isPending || !address}
          onClick={() => run(() => signMessage('Hello from Openfort!'))}
        >
          {isPending ? 'Waiting…' : 'Sign message'}
        </Button>
        <Button
          variant="outline"
          disabled={isPending || !address}
          onClick={() => run(() => signTypedData(sampleTypedData(chainId)))}
        >
          Sign typed data
        </Button>
      </div>
      <InputMessage
        message={signature ? `Signed: ${signature.slice(0, 10)}…${signature.slice(-8)}` : ''}
        show={!!signature}
        variant="success"
      />
      <InputMessage message={error?.message ?? ''} show={!!error} variant="error" />
    </>
  )
}

export const SendWidget = () => {
  const ui = useUI()
  return (
    <Button variant="outline" className="w-full" onClick={() => ui.openSend()}>
      Open Send
    </Button>
  )
}

export const FundWidget = () => {
  const ui = useUI()
  return (
    <>
      {/* The buyer's region decides which rails the hub offers, so the presets
          matter just as much here as they do on the headless side. */}
      <FundingCountryPresets />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => ui.openFunding()}>
          Add funds (hub)
        </Button>
        <Button variant="outline" onClick={() => ui.openBuy()}>
          Buy with fiat
        </Button>
      </div>
    </>
  )
}

export const NetworkWidget = () => {
  const ui = useUI()
  return (
    <Button variant="outline" className="w-full" onClick={() => ui.openSwitchNetworks()}>
      Open network picker
    </Button>
  )
}

export const WalletsWidget = () => {
  const ui = useUI()
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => ui.openWallets()}>
        Wallet picker
      </Button>
      <Button variant="outline" onClick={() => ui.openProfile()}>
        Account overview
      </Button>
    </div>
  )
}

export const ExportKeyWidget = () => {
  const ui = useUI()
  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => ui.openExportKey()}>
        Export private key
      </Button>
      <Button variant="outline" className="w-full" onClick={() => ui.openSettings()}>
        Recovery settings
      </Button>
    </>
  )
}

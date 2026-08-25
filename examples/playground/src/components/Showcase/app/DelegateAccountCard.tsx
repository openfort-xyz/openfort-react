import { AccountTypeEnum, use7702Authorization, useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useCallback, useEffect, useState } from 'react'
import { http, zeroAddress } from 'viem'
import {
  createBundlerClient,
  createPaymasterClient,
  entryPoint08Abi,
  entryPoint08Address,
  toSimple7702SmartAccount,
} from 'viem/account-abstraction'
import { toAccount } from 'viem/accounts'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toError } from '@/lib/errors'

/**
 * Openfort's "Simple" EIP-7702 implementation. Openfort delegates a Delegated
 * Account to Calibur on its own; this card covers the other path in the docs —
 * delegating an EOA yourself, to an implementation you choose.
 * https://www.openfort.io/docs/products/embedded-wallet/react/wallet/actions/eip-7702-authorization
 */
const SIMPLE_7702_IMPLEMENTATION = (import.meta.env.VITE_SIMPLE_7702_IMPLEMENTATION ??
  '0xe6Cae83BdE06E4c305530e199D7217f42808555B') as `0x${string}`

const FEE_SPONSORSHIP_ID = import.meta.env.VITE_FEE_SPONSORSHIP_ID as string | undefined

/** EIP-7702 marks a delegated account with `0xef0100 ++ implementation`. */
const DELEGATION_PREFIX = '0xef0100'

/**
 * Manual EIP-7702 delegation for an EOA.
 *
 * Only an **EOA** can be delegated: a Smart Account is already a contract, and a
 * Delegated Account has the SDK attach its own authorization on the first send.
 * Signing is `use7702Authorization`; the authorization then has to be carried by
 * a transaction, which here is a sponsored no-op UserOperation through Openfort's
 * bundler so the account never needs gas of its own.
 */
export const DelegateAccountCard = () => {
  const wallet = useEthereumEmbeddedWallet()
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { signAuthorization } = use7702Authorization()
  const { client } = useOpenfort()

  const [code, setCode] = useState<string | undefined>()
  const [isPending, setIsPending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const accountType = wallet.activeWallet?.accountType
  const isEOA = accountType === AccountTypeEnum.EOA
  const isDelegated = !!code && code !== '0x'

  const refresh = useCallback(async () => {
    if (!publicClient || !address) return
    setCode(await publicClient.getCode({ address }))
  }, [publicClient, address])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const delegate = async () => {
    if (!publicClient || !walletClient || !address) return
    setIsPending(true)
    setError(null)
    setResult(null)
    try {
      const nonce = await publicClient.getTransactionCount({ address })
      const signed = await signAuthorization({
        contractAddress: SIMPLE_7702_IMPLEMENTATION,
        chainId,
        nonce,
      })
      if (signed.status === 'error') throw signed.error
      const authorization = signed.authorization

      const transport = http(`https://api.openfort.io/rpc/${chainId}`, {
        fetchOptions: {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY}` },
        },
        timeout: 60_000,
      })
      // Simple7702Account verifies an EIP-191 signature over the userOpHash, which
      // the embedded wallet can produce through personal_sign. viem wants a local
      // account shape, so adapt the wallet client into one.
      const owner = toAccount({
        address,
        // Raw digest, no EIP-191 prefix — the embedded signer exposes this directly.
        sign: ({ hash }) =>
          client.embeddedWallet.signMessage(hash, {
            hashMessage: false,
            arrayifyMessage: false,
          }) as Promise<`0x${string}`>,
        signMessage: ({ message }) => walletClient.signMessage({ message }),
        signTypedData: (typedData) =>
          walletClient.signTypedData(typedData as Parameters<typeof walletClient.signTypedData>[0]),
        signTransaction: () => {
          throw new Error('The embedded wallet signs user operations, not raw transactions.')
        },
      })
      const account = await toSimple7702SmartAccount({
        // `toAccount` types sign/signAuthorization as optional even when supplied,
        // while toSimple7702SmartAccount requires them.
        owner: owner as Parameters<typeof toSimple7702SmartAccount>[0]['owner'],
        client: publicClient,
        entryPoint: { abi: entryPoint08Abi, address: entryPoint08Address, version: '0.8' },
      })
      const bundlerClient = createBundlerClient({
        account,
        client: publicClient,
        paymaster: createPaymasterClient({ transport }),
        // Only pin a policy when one is configured; otherwise let the project's
        // own sponsorship settings decide, so delegating needs no extra setup.
        ...(FEE_SPONSORSHIP_ID ? { paymasterContext: { policyId: FEE_SPONSORSHIP_ID } } : {}),
        transport,
      })

      // The bundler's gas floor sits above the chain's own suggestion.
      const fees = await publicClient.estimateFeesPerGas()
      const maxPriorityFeePerGas = fees.maxPriorityFeePerGas * 20n
      const hash = await bundlerClient.sendUserOperation({
        calls: [{ to: zeroAddress, data: '0x', value: 0n }],
        authorization,
        maxFeePerGas: fees.maxFeePerGas * 2n + maxPriorityFeePerGas,
        maxPriorityFeePerGas,
      })
      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash })
      setResult(`Delegated in ${receipt.receipt.transactionHash}`)
      await refresh()
    } catch (err) {
      setError(toError(err))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delegate account (EIP-7702)</CardTitle>
        <CardDescription>
          Point an EOA at a smart-account implementation so it can batch calls and be sponsored, keeping the same
          address and key.
        </CardDescription>
        <HookBadge hook="use7702Authorization" className="mt-1" />
      </CardHeader>
      <CardContent className="space-y-2">
        <dl className="grid grid-cols-2 gap-1 text-xs">
          <dt className="text-muted-foreground">Account type</dt>
          <dd className="text-right font-mono">{accountType ?? '—'}</dd>
          <dt className="text-muted-foreground">On-chain</dt>
          <dd className="text-right font-mono">
            {isDelegated ? `→ 0x${code?.slice(DELEGATION_PREFIX.length)}` : 'not delegated'}
          </dd>
        </dl>

        <Button className="w-full" disabled={!isEOA || isDelegated || isPending || !walletClient} onClick={delegate}>
          {isPending ? 'Delegating…' : 'Delegate account'}
        </Button>

        <InputMessage
          message="Only an EOA can be delegated here. A Smart Account is already a contract, and a Delegated Account gets its authorization attached by the SDK on the first send."
          show={!isEOA}
          variant="warning"
        />
        <InputMessage message="This account is already delegated." show={isEOA && isDelegated} variant="success" />
        <InputMessage message={result ?? ''} show={!!result} variant="success" />
        <InputMessage message={error?.message ?? ''} show={!!error} variant="error" />
      </CardContent>
    </Card>
  )
}

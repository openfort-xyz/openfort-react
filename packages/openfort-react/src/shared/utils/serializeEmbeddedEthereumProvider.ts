import type { Openfort } from '@openfort/openfort-js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types.js'
import { assertEmbeddedEthereumAccount } from './assertEmbeddedEthereumAccount.js'
import { runEmbeddedSignerOperation } from './embeddedSignerOperationQueue.js'

type ProviderBinding = {
  client: Openfort
  rawProvider: OpenfortEmbeddedEthereumWalletProvider
  expectedAddress?: `0x${string}`
}

const providerBindings = new WeakMap<OpenfortEmbeddedEthereumWalletProvider, ProviderBinding>()

/**
 * Methods that read state without touching the embedded signer.
 *
 * The queue exists to stop concurrent operations from swapping the signer under
 * one another, which these cannot do. openfort-js forwards them straight to the
 * configured RPC endpoint with no timeout of its own, so serializing them would
 * let one stalled node block signing for the rest of the session.
 *
 * `eth_accounts` and `eth_chainId` are also exempt from the account pin: EIP-1193
 * requires them to report current state, and wagmi's `isAuthorized()` treats a
 * rejection as a failed reconnect rather than a disconnected wallet.
 */
const UNSERIALIZED_METHODS = new Set([
  'eth_accounts',
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'net_version',
])

/** Routes public provider requests through the client queue and optionally pins them to one account. */
export function serializeEmbeddedEthereumProvider(
  provider: OpenfortEmbeddedEthereumWalletProvider,
  client: Openfort,
  expectedAddress?: `0x${string}`
): OpenfortEmbeddedEthereumWalletProvider {
  const binding = providerBindings.get(provider)
  const preservesExistingBinding = expectedAddress === undefined && binding?.client === client
  const matchesRequestedBinding =
    binding?.client === client && binding.expectedAddress?.toLowerCase() === expectedAddress?.toLowerCase()
  if (preservesExistingBinding || matchesRequestedBinding) {
    return provider
  }
  const rawProvider = binding?.rawProvider ?? provider
  const serializedProvider = new Proxy(rawProvider, {
    get(target, property) {
      if (property === 'request') {
        return (args: Parameters<OpenfortEmbeddedEthereumWalletProvider['request']>[0]) => {
          if (UNSERIALIZED_METHODS.has(args.method)) return target.request(args)
          return runEmbeddedSignerOperation(client, async ({ assertCurrent }) => {
            // Use the raw provider while holding the queue. Calling the proxy here
            // would try to acquire the same non-reentrant queue a second time.
            if (expectedAddress) {
              await assertEmbeddedEthereumAccount(target, expectedAddress)
            }
            assertCurrent()
            return target.request(args)
          })
        }
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  providerBindings.set(serializedProvider, { client, rawProvider, expectedAddress })
  return serializedProvider
}

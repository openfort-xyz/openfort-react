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
        return (args: Parameters<OpenfortEmbeddedEthereumWalletProvider['request']>[0]) =>
          runEmbeddedSignerOperation(client, async ({ assertCurrent }) => {
            // Use the raw provider while holding the queue. Calling the proxy here
            // would try to acquire the same non-reentrant queue a second time.
            if (expectedAddress) {
              await assertEmbeddedEthereumAccount(target, expectedAddress)
            }
            assertCurrent()
            return target.request(args)
          })
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
  providerBindings.set(serializedProvider, { client, rawProvider, expectedAddress })
  return serializedProvider
}

import type { Openfort } from '@openfort/openfort-js'
import type { CreateConnectorFn } from 'wagmi'
// wagmi is an optional peer; see useEmbeddedWalletWagmiSync.ts for why this is a
// namespace import rather than named bindings.
import * as wagmi from 'wagmi'
import { embeddedWalletId } from '../constants/openfort.js'
import { ChainNotConfiguredError } from '../errors/config.js'
import { ProviderNotReadyError } from '../errors/wallet.js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../ethereum/types.js'
import { serializeEmbeddedEthereumProvider } from '../shared/utils/serializeEmbeddedEthereumProvider.js'
import { logger } from '../utils/logger.js'

// Module-level provider store — injected when embedded wallet becomes active
let _provider: OpenfortEmbeddedEthereumWalletProvider | null = null

export function setEmbeddedWalletProvider(provider: null): void
export function setEmbeddedWalletProvider(provider: OpenfortEmbeddedEthereumWalletProvider, client: Openfort): void
export function setEmbeddedWalletProvider(
  provider: OpenfortEmbeddedEthereumWalletProvider | null,
  client?: Openfort
): void {
  if (provider && !client) {
    throw new ProviderNotReadyError('The embedded wallet client is required to serialize provider requests.')
  }
  _provider = provider ? serializeEmbeddedEthereumProvider(provider, client as Openfort) : null
}

export function embeddedWalletConnector(): CreateConnectorFn<OpenfortEmbeddedEthereumWalletProvider | undefined> {
  return wagmi.createConnector((config) => {
    const accountsChangedHandler = (accs: unknown) => {
      // The connector publishes only valid EVM accounts to wagmi.
      const valid = (accs as string[]).filter((a) => /^0x[0-9a-fA-F]{40}$/i.test(a))
      if (valid.length === 0) return
      config.emitter.emit('change', { accounts: valid as `0x${string}`[] })
    }
    const chainChangedHandler = (chain: unknown) => {
      config.emitter.emit('change', { chainId: Number(chain) })
    }
    const disconnectHandler = () => {
      config.emitter.emit('disconnect')
    }

    return {
      id: embeddedWalletId,
      name: 'Openfort Embedded Wallet',
      type: 'openfort-embedded' as const,

      async connect<withCapabilities extends boolean = false>({
        chainId,
      }: {
        chainId?: number
        isReconnecting?: boolean
        withCapabilities?: withCapabilities | boolean
      } = {}) {
        const provider = _provider
        if (!provider) throw new ProviderNotReadyError('Embedded wallet provider not ready.')
        const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as readonly `0x${string}`[]
        const currentChainId = await this.getChainId()
        provider.on('accountsChanged', accountsChangedHandler)
        provider.on('chainChanged', chainChangedHandler)
        provider.on('disconnect', disconnectHandler)

        // The embedded account is restored from storage carrying its own chain, so
        // the provider comes back on that chain rather than the one the application
        // is on. Move the provider onto the requested chain, the way the SDK-only
        // strategy does, instead of reporting the account's chain back to wagmi and
        // silently replacing the user's selection. Only a chain that the provider
        // actually ends up on is reported, so the two can never disagree.
        const requested = chainId !== undefined && config.chains.some((c) => c.id === chainId) ? chainId : undefined
        if (requested === undefined || requested === currentChainId) {
          return { accounts: accounts as never, chainId: requested ?? currentChainId }
        }

        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${requested.toString(16)}` }],
          })
          return { accounts: accounts as never, chainId: requested }
        } catch (error) {
          // The account may not exist on the requested chain. Connecting on the
          // provider's chain beats failing the connection outright.
          logger.warn('[@openfort/react] Could not connect on the requested chain', error)
          return { accounts: accounts as never, chainId: currentChainId }
        }
      },

      async disconnect() {
        // Auth lifecycle owned by Openfort, not wagmi — no-op
        _provider?.removeListener?.('accountsChanged', accountsChangedHandler)
        _provider?.removeListener?.('chainChanged', chainChangedHandler)
        _provider?.removeListener?.('disconnect', disconnectHandler)
      },

      async getAccounts() {
        if (!_provider) return [] as readonly `0x${string}`[]
        return (await _provider.request({ method: 'eth_accounts' })) as readonly `0x${string}`[]
      },

      async getChainId() {
        if (!_provider) return config.chains[0]?.id ?? 1
        const hex = await _provider.request({ method: 'eth_chainId' })
        return Number(hex)
      },

      async getProvider() {
        return _provider ?? undefined
      },

      async switchChain({ chainId }) {
        const provider = _provider
        if (!provider) throw new ProviderNotReadyError('Embedded wallet provider not ready.')
        const chain = config.chains.find((c) => c.id === chainId)
        if (!chain) throw new ChainNotConfiguredError({ chainId })
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${chainId.toString(16)}` }],
        })
        config.emitter.emit('change', { chainId })
        return chain
      },

      async isAuthorized() {
        if (!_provider) return false
        const accounts = (await _provider.request({ method: 'eth_accounts' })) as string[]
        return accounts.length > 0
      },

      onAccountsChanged(accounts) {
        config.emitter.emit('change', { accounts: accounts as `0x${string}`[] })
      },
      onChainChanged(chain) {
        config.emitter.emit('change', { chainId: Number(chain) })
      },
      onDisconnect() {
        config.emitter.emit('disconnect')
      },
    }
  })
}

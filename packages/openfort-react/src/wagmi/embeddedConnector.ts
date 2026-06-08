import { type CreateConnectorFn, createConnector } from 'wagmi'
import { embeddedWalletId } from '../constants/openfort'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../ethereum/types'

// Module-level provider store — injected when embedded wallet becomes active
let _provider: OpenfortEmbeddedEthereumWalletProvider | null = null

export function setEmbeddedWalletProvider(p: OpenfortEmbeddedEthereumWalletProvider | null) {
  _provider = p
}

export function embeddedWalletConnector(): CreateConnectorFn<OpenfortEmbeddedEthereumWalletProvider | undefined> {
  return createConnector((config) => {
    const accountsChangedHandler = (accs: unknown) => {
      // Filter out non-EVM addresses (e.g. Solana base58) that the SDK may emit
      // when recover() is called for a Solana wallet — sdk bug, defensive guard.
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
        if (!provider) throw new Error('Embedded wallet provider not ready')
        const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as readonly `0x${string}`[]
        const currentChainId = await this.getChainId()
        provider.on('accountsChanged', accountsChangedHandler)
        provider.on('chainChanged', chainChangedHandler)
        provider.on('disconnect', disconnectHandler)
        return {
          accounts: accounts as never,
          chainId: chainId ?? currentChainId,
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
        if (!provider) throw new Error('Embedded wallet provider not ready')
        const chain = config.chains.find((c) => c.id === chainId)
        if (!chain) throw new Error(`Chain ${chainId} is not configured`)
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

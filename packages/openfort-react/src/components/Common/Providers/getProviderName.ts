import type { UserAccount } from '@openfort/openfort-js'

export const getProviderName = (provider: UserAccount['provider']) => {
  switch (provider) {
    case 'wallet':
    case 'siwe':
      return 'Wallet'
    case 'email':
    case 'credential':
      return 'Email'
    default:
      return provider.charAt(0).toUpperCase() + provider.slice(1)
  }
}

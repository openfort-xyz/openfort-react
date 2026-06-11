/**
 * Centralized query key factory for all TanStack Query operations.
 *
 * Using a factory ensures consistent key structures across the SDK,
 * making cache invalidation predictable and type-safe.
 */
export const openfortKeys = {
  all: ['openfort'] as const,

  user: () => [...openfortKeys.all, 'user'] as const,

  embeddedAccounts: () => [...openfortKeys.all, 'embeddedAccounts'] as const,

  walletAssets: (chainId: number, customAssets: readonly string[], address: string | undefined) =>
    [...openfortKeys.all, 'walletAssets', chainId, customAssets, address] as const,
}

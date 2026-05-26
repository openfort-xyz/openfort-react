import type { OpenfortPlaygroundMode } from '@/providers'
import type { FileRoutesByTo } from '@/routeTree.gen'

export type NavRoute = {
  href?: keyof FileRoutesByTo
  label: string
  exact?: boolean
  children?: NavRoute[]
  /** Chains this route applies to. Omitted = shown in every chain mode. */
  modes?: OpenfortPlaygroundMode[]
}

export const navRoutes: NavRoute[] = [
  {
    label: 'Auth hooks',
    children: [
      {
        href: '/auth/useGuestAuth',
        label: 'useGuestAuth',
      },
      {
        href: '/auth/useEmailAuth',
        label: 'useEmailAuth',
      },
      {
        href: '/auth/useOauth',
        label: 'useOauth',
      },
      {
        href: '/auth/useAuthCallback',
        label: 'useAuthCallback',
      },
      {
        href: '/auth/useConnectWithSiwe',
        label: 'useConnectWithSiwe',
        modes: ['evm'],
      },
      {
        href: '/auth/useWalletAuth',
        label: 'useWalletAuth',
        modes: ['evm'],
      },
      {
        href: '/auth/useSignOut',
        label: 'useSignOut',
      },
      {
        href: '/auth/useUser',
        label: 'useUser',
      },
    ],
  },
  {
    label: 'Wallet hooks',
    children: [
      {
        href: '/wallet/useSolanaEmbeddedWallet',
        label: 'useSolanaEmbeddedWallet',
        modes: ['svm'],
      },
      {
        href: '/wallet/useEthereumEmbeddedWallet',
        label: 'useEthereumEmbeddedWallet',
        modes: ['evm'],
      },
      {
        href: '/wallet/useEthereumWalletAssets',
        label: 'useEthereumWalletAssets',
        modes: ['evm'],
      },
    ],
  },
  {
    label: 'Utils',
    children: [
      {
        href: '/utils/useUI',
        label: 'useUI',
      },
      {
        href: '/wagmi',
        label: 'wagmi',
        modes: ['evm'],
      },
    ],
  },
]

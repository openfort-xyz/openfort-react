import { ChainTypeEnum, useOpenfort, useUser } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { Link } from '@tanstack/react-router'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { TruncatedText } from '@/components/TruncatedText'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { PLAYGROUND_EVM_CHAINS } from '@/lib/chains'
import { usePlaygroundMode } from '@/providers'

const PanelLink = ({ children, href }: PropsWithChildren<{ href: string }>) => {
  return (
    <Link to={href} className="group inline-flex items-center text-inherit hover:text-foreground">
      {children}
      <ArrowUpRight className="ml-1 inline-block size-3 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  )
}

export const AccountPanel = () => {
  const { mode } = usePlaygroundMode()
  const { user, linkedAccounts } = useUser()
  const { chainType } = useOpenfort()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const isConnected = wallet.status === 'connected'
  const address = isConnected && 'address' in wallet ? wallet.address : undefined
  const chainId =
    isConnected && chainType === ChainTypeEnum.EVM && 'chainId' in wallet
      ? (wallet as typeof ethereumWallet).chainId
      : undefined
  const connectedChain = PLAYGROUND_EVM_CHAINS.find((c) => c.id === chainId)

  const walletHookHref = mode === 'svm' ? '/wallet/useSolanaEmbeddedWallet' : '/wallet/useEthereumEmbeddedWallet'

  return (
    <Collapsible defaultOpen className="px-2 pb-2 text-xs">
      <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md px-2 py-1.5 font-medium text-foreground hover:bg-sidebar-accent">
        Account
        <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-1 px-2 pt-1 text-muted-foreground">
        <PanelLink href="/auth/useUser">
          User ID: <span className="ml-1">{user ? <TruncatedText text={user.id} /> : 'none'}</span>
        </PanelLink>
        <PanelLink href="/auth/useUser">
          Auth methods:{' '}
          <span className="ml-1">{user ? `[${linkedAccounts.map((a) => a.provider).join(',')}]` : 'none'}</span>
        </PanelLink>
        <PanelLink href={walletHookHref}>
          Wallet: <span className="ml-1">{address ? <TruncatedText text={address} /> : 'not connected'}</span>
        </PanelLink>
        <PanelLink href={walletHookHref}>
          Chain: <span className="ml-1">{address ? (connectedChain?.name ?? 'unknown') : 'not connected'}</span>
        </PanelLink>
      </CollapsibleContent>
    </Collapsible>
  )
}

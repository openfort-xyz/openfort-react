import { ChainTypeEnum, useOpenfort, useSignOut, useUser } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { FundingScenarios } from '@/components/FundingScenarios'
import { ActionCard } from '@/components/Showcase/ActionCard'
import { DelegateAccountCard } from '@/components/Showcase/app/DelegateAccountCard'
import { SendTransactionCardSolana } from '@/components/Showcase/app/SendTransactionCardSolana'
import { SessionKeysCard } from '@/components/Showcase/app/SessionKeys'
import { SetActiveWalletsCardEthereum } from '@/components/Showcase/app/SetActiveWallets'
import { SetActiveWalletsCardSolana } from '@/components/Showcase/app/SetActiveWalletsCardSolana'
import { SignaturesCardEVM } from '@/components/Showcase/app/SignaturesCardEVM'
import { SignaturesCardSolana } from '@/components/Showcase/app/SignaturesCardSolana'
import { SiweCard } from '@/components/Showcase/app/SiweCard'
import { SolanaOpenfortUICard } from '@/components/Showcase/app/SolanaOpenfortUICard'
import { SwitchChainCardEVM } from '@/components/Showcase/app/SwitchChainCardEVM'
import { TransactionHistoryCardSolana } from '@/components/Showcase/app/TransactionHistoryCardSolana'
import { WriteContractCard } from '@/components/Showcase/app/WriteContract'
import {
  ExportKeyWidget,
  FundWidget,
  NetworkWidget,
  SendWidget,
  SignWidget,
  WalletsWidget,
} from '@/components/Showcase/app/widgets'
import { TruncatedText } from '@/components/TruncatedText'
import { Button } from '@/components/ui/button'
import { useDisplayEthereumAddress } from '@/hooks/useConnectedEthereumAccount'
import { usePlaygroundMode } from '@/providers'

/**
 * The showcase is organised by **action** — sign, transact, fund, switch network,
 * manage wallets — and each action offers the two ways of shipping it: drive the
 * SDK hooks behind your own UI, or hand off to Openfort's prebuilt widget.
 */
export const App = () => {
  const { user } = useUser()
  const { chainType } = useOpenfort()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet
  const displayEthereumAddress = useDisplayEthereumAddress()

  const address =
    chainType === ChainTypeEnum.EVM
      ? displayEthereumAddress
      : wallet.status === 'connected' && 'address' in wallet
        ? wallet.address
        : undefined
  const { signOut } = useSignOut()
  const { mode } = usePlaygroundMode()
  const isSVM = mode === 'svm'

  return (
    <div className="h-full w-full p-4 ">
      <div className="flex justify-between items-start mb-6">
        <div className="space-y-1">
          <h1 className="text-xl">Welcome, {user?.id}</h1>
          <p className="text-muted-foreground">Connected with {address ? <TruncatedText text={address} /> : '...'}</p>
        </div>

        <Button variant="outline" size="sm" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {isSVM ? (
          <>
            <SolanaOpenfortUICard hook="useUI (Openfort UI)" />
            <SignaturesCardSolana hook="useSolanaMessageSigner" />
            <SendTransactionCardSolana hook="sendSolTransaction" />
            <TransactionHistoryCardSolana hook="getTransactionHistory" />
            <SetActiveWalletsCardSolana />
          </>
        ) : (
          <>
            <ActionCard
              title="Sign"
              description="Prove ownership of the wallet by signing a message or typed data."
              headless={{ hook: 'useSignMessage (wagmi)', content: <SignaturesCardEVM bare /> }}
              widget={{ hook: 'useSignMessage (Openfort)', content: <SignWidget /> }}
            />

            <ActionCard
              title="Transact"
              description="Send value or call a contract from the connected wallet."
              headless={{ hook: 'useWriteContract', content: <WriteContractCard bare /> }}
              widget={{ hook: 'useUI().openSend', content: <SendWidget /> }}
            />

            <ActionCard
              title="Fund"
              description="Move money in — from another wallet, an exchange, or a card."
              headless={{ hook: 'useFunding', content: <FundingScenarios bare /> }}
              widget={{ hook: 'useUI().openFunding', content: <FundWidget /> }}
            />

            <ActionCard
              title="Network"
              description="Move the wallet between the chains your project supports."
              headless={{ hook: 'useSwitchChain', content: <SwitchChainCardEVM bare /> }}
              widget={{ hook: 'useUI().openSwitchNetworks', content: <NetworkWidget /> }}
            />

            <ActionCard
              title="Wallets"
              description="Create embedded wallets and switch the active one."
              headless={{
                hook: 'useEthereumEmbeddedWallet',
                content: <SetActiveWalletsCardEthereum bare />,
              }}
              widget={{ hook: 'useUI().openWallets', content: <WalletsWidget /> }}
            />

            <ActionCard
              title="Keys & recovery"
              description="Export the private key or change how the wallet is recovered."
              widget={{ hook: 'useUI().openExportKey', content: <ExportKeyWidget /> }}
            />

            <DelegateAccountCard />
            <SessionKeysCard hook="useGrantPermissions" />
            <SiweCard hook="createSIWEMessage · useSignMessage" />
          </>
        )}
      </div>
    </div>
  )
}

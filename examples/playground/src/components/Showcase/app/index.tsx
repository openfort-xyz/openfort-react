import { ChainTypeEnum, useOpenfort, useSignOut, useUser } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { ConnectExternalWalletCard } from '@/components/Showcase/app/ConnectExternalWalletCard'
import { SendTransactionCardSolana } from '@/components/Showcase/app/SendTransactionCardSolana'
import { SessionKeysCard } from '@/components/Showcase/app/SessionKeys'
import { SessionKeysCardEVM } from '@/components/Showcase/app/SessionKeysCardEVM'
import { SetActiveWalletsCardEthereum } from '@/components/Showcase/app/SetActiveWallets'
import { SetActiveWalletsCardSolana } from '@/components/Showcase/app/SetActiveWalletsCardSolana'
import { SignaturesCard } from '@/components/Showcase/app/Signatures'
import { SignaturesCardEVM } from '@/components/Showcase/app/SignaturesCardEVM'
import { SignaturesCardSolana } from '@/components/Showcase/app/SignaturesCardSolana'
import { SwitchChainCardEVM } from '@/components/Showcase/app/SwitchChainCardEVM'
import { TransactionHistoryCardSolana } from '@/components/Showcase/app/TransactionHistoryCardSolana'
import { WriteContractCard } from '@/components/Showcase/app/WriteContract'
import { WriteContractCardEVM } from '@/components/Showcase/app/WriteContractCardEVM'
import { TruncatedText } from '@/components/TruncatedText'
import { Button } from '@/components/ui/button'
import { useDisplayEthereumAddress } from '@/hooks/useConnectedEthereumAccount'
import { usePlaygroundMode } from '@/providers'

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
  const hasWagmi = mode === 'evm'

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
            <SignaturesCardSolana hook="useSolanaMessageSigner" />
            <SendTransactionCardSolana hook="sendSolTransaction" />
            <TransactionHistoryCardSolana hook="getTransactionHistory" />
            <SetActiveWalletsCardSolana />
          </>
        ) : hasWagmi ? (
          <>
            <SignaturesCard hook="useSignMessage" />
            <WriteContractCard hook="useWriteContract" />
            <SwitchChainCardEVM hook="useSwitchChain" />
            <div className="lg:col-span-2 xl:col-span-3 flex flex-col lg:flex-row gap-4">
              <SessionKeysCard hook="useGrantPermissions" />
              <div className="min-w-[40%]">
                <ConnectExternalWalletCard />
              </div>
            </div>
          </>
        ) : (
          <>
            <SignaturesCardEVM hook="viem signMessage" />
            <WriteContractCardEVM hook="viem readContract / writeContract" />
            <SwitchChainCardEVM hook="wallet_switchEthereumChain" />
            <SessionKeysCardEVM hook="useGrantPermissions" />
          </>
        )}
        {!isSVM && !hasWagmi && <SetActiveWalletsCardEthereum />}
      </div>
    </div>
  )
}

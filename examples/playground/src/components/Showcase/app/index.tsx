import { ChainTypeEnum, useOpenfort, useSignOut, useUser } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { ConnectExternalWalletCard } from '@/components/Showcase/app/ConnectExternalWalletCard'
import { OpenfortUICard } from '@/components/Showcase/app/OpenfortUICard'
import { SendTransactionCardSolana } from '@/components/Showcase/app/SendTransactionCardSolana'
import { SessionKeysCard } from '@/components/Showcase/app/SessionKeys'
import { SessionKeysCardEVM } from '@/components/Showcase/app/SessionKeysCardEVM'
import { SetActiveWalletsCardEthereum } from '@/components/Showcase/app/SetActiveWallets'
import { SetActiveWalletsCardSolana } from '@/components/Showcase/app/SetActiveWalletsCardSolana'
import { SignaturesCardEVM } from '@/components/Showcase/app/SignaturesCardEVM'
import { SignaturesCardSolana } from '@/components/Showcase/app/SignaturesCardSolana'
import { SiweCard } from '@/components/Showcase/app/SiweCard'
import { SolanaOpenfortUICard } from '@/components/Showcase/app/SolanaOpenfortUICard'
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
            <SolanaOpenfortUICard hook="useUI (Openfort UI)" />
            <SignaturesCardSolana hook="useSolanaMessageSigner" />
            <SendTransactionCardSolana hook="sendSolTransaction" />
            <TransactionHistoryCardSolana hook="getTransactionHistory" />
            <SetActiveWalletsCardSolana />
          </>
        ) : hasWagmi ? (
          <>
            <OpenfortUICard hook="useUI (Openfort UI)" />
            <SiweCard hook="createSIWEMessage · useSignMessage" />
            <WriteContractCard hook="useWriteContract" />
            <SwitchChainCardEVM hook="useSwitchChain" />
            <SessionKeysCard hook="useGrantPermissions" />
            <ConnectExternalWalletCard />
          </>
        ) : (
          <>
            <OpenfortUICard hook="useUI (Openfort UI)" />
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

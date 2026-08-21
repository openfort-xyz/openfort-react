'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { lazy } from 'react'
import { routes } from '../Openfort/types.js'
import AssetInventory from '../Pages/AssetInventory/index.js'
import { SolanaAssetInventory } from '../Pages/AssetInventory/SolanaAssetInventory.js'
import Connected from '../Pages/Connected/index.js'
import ConnectedSuccess from '../Pages/ConnectedSuccess/index.js'
import CreateGuestUserPage from '../Pages/CreateGuestUserPage/index.js'
import CreateWallet from '../Pages/CreateWallet/index.js'
import DownloadApp from '../Pages/DownloadApp/index.js'
import EmailLogin from '../Pages/EmailLogin/index.js'
import EmailOTP from '../Pages/EmailOTP/index.js'
import EmailVerification from '../Pages/EmailVerification/index.js'
import ForgotPassword from '../Pages/ForgotPassword/index.js'
import LinkEmail from '../Pages/LinkEmail/index.js'
import LinkedProvider from '../Pages/LinkedProvider/index.js'
import LinkedProviders from '../Pages/LinkedProviders/index.js'
import Loading from '../Pages/Loading/index.js'
import LoadWallets from '../Pages/LoadWallets/index.js'
import MobileConnectors from '../Pages/MobileConnectors/index.js'
import NoAssetsAvailable from '../Pages/NoAssetsAvailable/index.js'
import PhoneOTP from '../Pages/PhoneOTP/index.js'
import Profile from '../Pages/Profile/index.js'
import Providers from '../Pages/Providers/index.js'
import Receive from '../Pages/Receive/index.js'
import RecoverPage from '../Pages/Recover/index.js'
import RemoveLinkedProvider from '../Pages/RemoveLinkedProvider/index.js'
import SelectWalletToRecover from '../Pages/SelectWalletToRecover/index.js'
import SignMessage from '../Pages/SignMessage/index.js'
import SocialProviders from '../Pages/SocialProviders/index.js'
import ConnectUsing from './ConnectUsing.js'
import ConnectWithMobile from './ConnectWithMobile.js'
import { withPageLoading } from './pageLoading.js'

type ValueOf<T> = T[keyof T]

/** Route id to the element rendered for it. A route with no entry renders nothing. */
type RoutePages = Partial<Record<ValueOf<typeof routes>, React.ReactNode>>

// Code-split page groups a session may never visit: the funding, transfer, key
// export and external-wallet screens. Each is a static specifier so
// every bundler can resolve and split it; see the note on the lazy imports in
// OpenfortProvider.
const LazyBuy = lazy(() => import('../Pages/Buy/index.js'))
const LazyBuyComplete = lazy(() => import('../Pages/BuyComplete/index.js'))
const LazyBuyProcessing = lazy(() => import('../Pages/BuyProcessing/index.js'))
const LazyStripeLinkCheckout = lazy(() => import('../Pages/StripeLinkCheckout/index.js'))
const LazyWalletPayContact = lazy(() => import('../Pages/WalletPayContact/index.js'))
const LazyWalletPayLimitUpgrade = lazy(() => import('../Pages/WalletPayLimitUpgrade/index.js'))
const LazyDeposit = lazy(() => import('../Pages/Deposit/index.js'))
const LazyDepositCex = lazy(() => import('../Pages/DepositCex/index.js'))
const LazyDepositCrypto = lazy(() => import('../Pages/DepositCrypto/index.js'))
const LazyDepositWallet = lazy(() => import('../Pages/DepositWallet/index.js'))
const LazyExportKey = lazy(() => import('../Pages/ExportKey/index.js'))
const LazySelectToken = lazy(() => import('../Pages/SelectToken/index.js'))
const LazySend = lazy(() => import('../Pages/Send/index.js'))
const LazySendConfirmation = lazy(() => import('../Pages/SendConfirmation/index.js'))
const LazyConnectors = lazy(() => import('../../wagmi/components/Connectors/index.js'))
const LazySwitchNetworks = lazy(() => import('../../wagmi/components/SwitchNetworks/index.js'))
const LazySolanaSelectToken = lazy(() =>
  import('../Pages/SelectToken/SolanaSelectToken.js').then((m) => ({ default: m.SolanaSelectToken }))
)
const LazySolanaSend = lazy(() => import('../Pages/Send/SolanaSend.js').then((m) => ({ default: m.SolanaSend })))
const LazySolanaSendConfirmation = lazy(() =>
  import('../Pages/SendConfirmation/SolanaSendConfirmation.js').then((m) => ({ default: m.SolanaSendConfirmation }))
)

/** Pages available on every chain type. */
export const sharedPages: RoutePages = {
  loading: <Loading />,
  loadWallets: <LoadWallets />,
  connectedSuccess: <ConnectedSuccess />,
  createGuestUser: <CreateGuestUserPage />,
  socialProviders: <SocialProviders />,
  emailLogin: <EmailLogin />,
  emailOtp: <EmailOTP />,
  phoneOtp: <PhoneOTP />,
  forgotPassword: <ForgotPassword />,
  emailVerification: <EmailVerification />,
  linkEmail: <LinkEmail />,
  createWallet: <CreateWallet />,
  recoverWallets: <RecoverPage />,
  download: <DownloadApp />,
  connectors: withPageLoading(<LazyConnectors />),
  mobileConnectors: <MobileConnectors />,
  selectWalletToRecover: <SelectWalletToRecover />,
  providers: <Providers />,
  connect: <ConnectUsing />,
  connected: <Connected />,
  profile: <Profile />,
  linkedProviders: <LinkedProviders />,
  linkedProvider: <LinkedProvider />,
  removeLinkedProvider: <RemoveLinkedProvider />,
  connectWithMobile: <ConnectWithMobile />,
  noAssetsAvailable: <NoAssetsAvailable />,
  assetInventory: <AssetInventory />,
  send: withPageLoading(<LazySend />),
  sendConfirmation: withPageLoading(<LazySendConfirmation />),
  sendTokenSelect: withPageLoading(<LazySelectToken isBuyFlow={false} />),
  buyTokenSelect: withPageLoading(<LazySelectToken isBuyFlow={true} />),
  buyWalletPayContact: withPageLoading(<LazyWalletPayContact />),
  buyStripeLink: withPageLoading(<LazyStripeLinkCheckout />),
  buyLimitUpgrade: withPageLoading(<LazyWalletPayLimitUpgrade />),
  buyProcessing: withPageLoading(<LazyBuyProcessing />),
  buyComplete: withPageLoading(<LazyBuyComplete />),
  receive: <Receive />,
  buy: withPageLoading(<LazyBuy />),
  deposit: withPageLoading(<LazyDeposit />),
  depositCrypto: withPageLoading(<LazyDepositCrypto />),
  depositWallet: withPageLoading(<LazyDepositWallet />),
  depositCex: withPageLoading(<LazyDepositCex />),
  exportKey: withPageLoading(<LazyExportKey />),
  signMessage: <SignMessage />,
}

/** Pages reached through a chain-prefixed route, keyed by the active chain type. */
export const chainPrefixedPages: Record<ChainTypeEnum, RoutePages> = {
  [ChainTypeEnum.EVM]: {
    'eth:connected': <Connected />,
    'eth:createWallet': <CreateWallet />,
    'eth:recoverWallet': <RecoverPage />,
    'eth:switchNetworks': withPageLoading(<LazySwitchNetworks />),
    'eth:send': withPageLoading(<LazySend />),
    'eth:receive': <Receive />,
    'eth:buy': withPageLoading(<LazyBuy />),
    'eth:connectors': withPageLoading(<LazyConnectors />),
  },
  [ChainTypeEnum.SVM]: {
    'sol:connected': <Connected />,
    'sol:createWallet': <CreateWallet />,
    'sol:recoverWallet': <RecoverPage />,
    'sol:send': withPageLoading(<LazySolanaSend />),
    'sol:sendTokenSelect': withPageLoading(<LazySolanaSelectToken />),
    'sol:sendConfirmation': withPageLoading(<LazySolanaSendConfirmation />),
    'sol:receive': <Receive />,
    'sol:assetInventory': <SolanaAssetInventory />,
  },
}

/** Route each chain type falls back to when the requested one has no page. */
export const defaultConnectedRoute: Record<ChainTypeEnum, ValueOf<typeof routes>> = {
  [ChainTypeEnum.EVM]: routes.ETH_CONNECTED,
  [ChainTypeEnum.SVM]: routes.SOL_CONNECTED,
}

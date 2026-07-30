import Logos from '../assets/logos.js'

/**
 * Wallet configuration metadata keyed by reverse-DNS identifiers.
 *
 * Follows EIP-6963 Multi Injected Provider Discovery: https://eips.ethereum.org/EIPS/eip-6963.
 */
export type WalletConfigProps = {
  // Wallets name
  name?: string
  // Wallets short name. Defaults to `name`
  shortName?: string
  // Icon to display in the modal
  icon?: string | React.ReactNode
  // Icon to use on the wallet list button. If not provided, `icon` will be used
  iconConnector?: React.ReactNode
  // Defaults to `'circle'`, but some icons look better as squircle (e.g. if they have a background)
  iconShape?: 'squircle' | 'circle' | 'square'
  // Defaults to `false`, but some icons don't have a background and look better if they shrink to fit the container
  iconShouldShrink?: boolean
  // Links to download the wallet
  downloadUrls?: {
    // Wallet's own download page, shown as a QR code so the user can open it on
    // the device they want to install on
    download?: string
    // wallet's website
    website?: string
    // app downloads
    desktop?: string
    android?: string
    ios?: string
    // browser extensions
    chrome?: string
    firefox?: string
    brave?: string
    edge?: string
    safari?: string
  }
  // Create URI for QR code, where uri is encoded data from WalletConnect
  getWalletConnectDeeplink?: (uri: string) => string
  shouldDeeplinkDesktop?: boolean
}

// Organised in alphabetical order by key
export const walletConfigs: {
  [rdns: string]: WalletConfigProps // for multiple cases seperate rdns by comma
} = {
  mock: {
    icon: <Logos.Mock />,
  },
  argent: {
    name: 'Argent',
    icon: <Logos.Argent />,
    downloadUrls: {
      android: 'https://play.google.com/store/apps/details?id=im.argent.contractwalletclient',
      ios: 'https://apps.apple.com/app/argent/id1358741926',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://argent.link/app/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  'coinbaseWallet, coinbaseWalletSDK': {
    name: 'Coinbase Wallet',
    shortName: 'Coinbase',
    icon: <Logos.Coinbase background />,
    iconShape: 'squircle',
    downloadUrls: {
      download: 'https://www.coinbase.com/wallet/downloads',
      website: 'https://www.coinbase.com/wallet/getting-started-extension',
      android: 'https://play.google.com/store/apps/details?id=org.toshi',
      ios: 'https://apps.apple.com/app/coinbase-wallet-store-crypto/id1278383455',
      chrome: 'https://chrome.google.com/webstore/detail/coinbase-wallet-extension/hnfanknocfeofbddgcijnmhnfnkdnaad',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://go.cb-w.com/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  'com.coinbase.wallet': {
    name: 'Coinbase Wallet',
    shortName: 'Coinbase',
    icon: <Logos.Coinbase background />,
    iconShape: 'circle',
    downloadUrls: {
      download: 'https://www.coinbase.com/wallet/downloads',
      website: 'https://www.coinbase.com/wallet/getting-started-extension',
      android: 'https://play.google.com/store/apps/details?id=org.toshi',
      ios: 'https://apps.apple.com/app/coinbase-wallet-store-crypto/id1278383455',
      chrome: 'https://chrome.google.com/webstore/detail/coinbase-wallet-extension/hnfanknocfeofbddgcijnmhnfnkdnaad',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://go.cb-w.com/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  'com.crypto.wallet': {
    name: 'Crypto.com',
    shortName: 'Crypto',
  },
  dawn: {
    name: 'Dawn Wallet',
    shortName: 'Dawn',
    downloadUrls: {
      download: 'https://apps.apple.com/us/app/dawn-ethereum-wallet/id1673143782',
      website: 'https://www.dawnwallet.xyz/',
      ios: 'https://apps.apple.com/us/app/dawn-ethereum-wallet/id1673143782',
    },
  },
  'co.family.wallet': {
    name: 'Family',
    shortName: 'Family',
    icon: <Logos.Family />,
    iconShape: 'squircle',
    downloadUrls: {
      download: 'https://family.co/download',
      website: 'https://family.co',
      ios: 'https://family.co/download',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `familywallet://wc?uri=${encodeURIComponent(uri)}`
    },
  },
  familyAccountsProvider: {
    name: 'Family',
    shortName: 'Family',
    icon: <Logos.FamilyAccount />,
    iconConnector: <Logos.FamilyAccount />,
    iconShape: 'squircle',
  },
  frame: {
    name: 'Frame',
    icon: <Logos.Frame />,
    iconShouldShrink: true,
    downloadUrls: {
      download: 'https://frame.sh',
      website: 'https://frame.sh',
      chrome: 'https://chrome.google.com/webstore/detail/frame-companion/ldcoohedfbjoobcadoglnnmmfbdlmmhf',
      firefox: 'https://addons.mozilla.org/en-US/firefox/addon/frame-extension',
      brave: 'https://chrome.google.com/webstore/detail/frame-companion/ldcoohedfbjoobcadoglnnmmfbdlmmhf',
    },
    getWalletConnectDeeplink: (uri: string) => uri,
  },
  frontier: {
    name: 'Frontier Wallet',
    shortName: 'Frontier',
    icon: <Logos.Frontier />,
    downloadUrls: {
      download: 'https://frontier.xyz/download',
      ios: 'https://apps.apple.com/app/frontier-crypto-defi-wallet/id1482380988',
      android: 'https://play.google.com/store/apps/details?id=com.frontierwallet',
      website: 'https://frontier.xyz/',
      chrome: 'https://chrome.google.com/webstore/detail/frontier-wallet/kppfdiipphfccemcignhifpjkapfbihd',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `frontier://wc?uri=${encodeURIComponent(uri)}`
    },
  },
  injected: {
    name: 'Browser Wallet',
    shortName: 'Browser',
    icon: <Logos.Injected />,
  },
  'metaMask, MetaMask, metaMask-io, io.metamask, io.metamask.mobile, metaMaskSDK': {
    name: 'MetaMask',
    icon: <Logos.MetaMask />,
    iconConnector: <Logos.MetaMask />,
    iconShouldShrink: true,
    downloadUrls: {
      download: 'https://metamask.io/download',
      website: 'https://metamask.io/download/',
      android: 'https://play.google.com/store/apps/details?id=io.metamask',
      ios: 'https://apps.apple.com/app/metamask/id1438144202',
      chrome: 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
      firefox: 'https://addons.mozilla.org/firefox/addon/ether-metamask/',
      brave: 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
      edge: 'https://microsoftedge.microsoft.com/addons/detail/metamask/ejbalbakoplchlghecdalmeeeajnimhm',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  'app.phantom': {
    name: 'Phantom',
    iconShape: 'squircle',
  },
  'me.rainbow': {
    name: 'Rainbow Wallet',
    shortName: 'Rainbow',
    icon: <Logos.Rainbow />,
    iconShape: 'squircle',
    downloadUrls: {
      download: 'https://rainbow.me/download',
      website: 'https://rainbow.me',
      android: 'https://play.google.com/store/apps/details?id=me.rainbow',
      ios: 'https://apps.apple.com/app/rainbow-ethereum-wallet/id1457119021',
      chrome: 'https://rainbow.me/extension',
      edge: 'https://rainbow.me/extension',
      brave: 'https://rainbow.me/extension',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://rnbwapp.com/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  'io.rabby': {
    name: 'Rabby Wallet',
    shortName: 'Rabby',
    downloadUrls: {
      website: 'https://rabby.io',
      chrome: 'https://chrome.google.com/webstore/detail/rabby-wallet/acmacodkjbdgmoleebolmdjonilkdbch',
    },
  },
  safe: {
    name: 'Safe',
    icon: <Logos.Safe />,
    downloadUrls: {
      download: 'https://safe.global/wallet',
      website: 'https://safe.global/',
      ios: 'https://apps.apple.com/app/id1515759131',
      android: 'https://play.google.com/store/apps/details?id=io.gnosis.safe',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://gnosis-safe.io/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  'xyz.talisman': {
    name: 'Talisman',
    shortName: 'Talisman',
    iconShape: 'squircle',
    downloadUrls: {
      download: 'https://talisman.xyz/download',
      website: 'https://talisman.xyz',
      chrome: 'https://chrome.google.com/webstore/detail/talisman-polkadot-wallet/fijngjgcjhjmmpcmkeiomlglpeiijkld',
      firefox: 'https://addons.mozilla.org/en-US/firefox/addon/talisman-wallet-extension/',
    },
  },
  'com.trustwallet.app': {
    name: 'Trust Wallet',
    shortName: 'Trust',
    icon: <Logos.Trust />,
    iconShouldShrink: true,
    downloadUrls: {
      download: 'https://trustwallet.com/download',
      android: 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp',
      ios: 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409',
    },
    getWalletConnectDeeplink(uri) {
      return `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  infinityWallet: {
    name: 'Infinity Wallet',
    icon: <Logos.InfinityWallet />,
    downloadUrls: {
      download: 'https://infinitywallet.io/download',
      website: 'https://infinitywallet.io/download',
      chrome: 'https://infinitywallet.io/download',
      firefox: 'https://infinitywallet.io/download',
      brave: 'https://infinitywallet.io/download',
      edge: 'https://infinitywallet.io/download',
    },
  },
  imToken: {
    name: 'imToken',
    icon: <Logos.ImToken />,
    downloadUrls: {
      download: 'https://token.im/download',
      website: 'https://token.im',
      android: 'https://play.google.com/store/apps/details?id=im.token.app',
      ios: 'https://itunes.apple.com/us/app/imtoken2/id1384798940',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `imtokenv2://wc?uri=${encodeURIComponent(uri)}`
    },
  },
  unstoppable: {
    name: 'Unstoppable',
    icon: <Logos.Unstoppable />,
    downloadUrls: {
      download: 'https://unstoppable.money/',
      ios: 'https://apps.apple.com/app/bank-bitcoin-wallet/id1447619907',
      android: 'https://play.google.com/store/apps/details?id=io.horizontalsystems.bankwallet',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://unstoppable.money/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  onto: {
    name: 'ONTO',
    icon: <Logos.ONTO />,
    downloadUrls: {
      download: 'https://onto.app/en/download/',
      ios: 'https://apps.apple.com/app/onto-an-ontology-dapp/id1436009823',
      android: 'https://play.google.com/store/apps/details?id=com.github.ontio.onto',
      website: 'https://onto.app/en/download/',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://onto.app/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  steak: {
    name: 'Steak',
    icon: <Logos.Steak />,
    downloadUrls: {
      download: 'https://steakwallet.fi/download',
      android: 'https://play.google.com/store/apps/details?id=fi.steakwallet.app',
      ios: 'https://apps.apple.com/app/steakwallet/id1569375204',
      website: 'https://steakwallet.fi/download',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://links.steakwallet.fi/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  ledger: {
    name: 'Ledger Live',
    shortName: 'Ledger',
    icon: <Logos.Ledger />,
    downloadUrls: {
      download: 'https://www.ledger.com/ledger-live/download',
      website: 'https://www.ledger.com/ledger-live/download',
      android: 'https://play.google.com/store/apps/details?id=com.ledger.live',
      ios: 'https://apps.apple.com/app/ledger-live-web3-wallet/id1361671700',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `ledgerlive://wc?uri=${encodeURIComponent(uri)}`
    },
    shouldDeeplinkDesktop: true,
  },
  zerion: {
    name: 'Zerion',
    icon: <Logos.Zerion />,
    downloadUrls: {
      download: 'https://zerion.io/download',
      ios: 'https://apps.apple.com/app/apple-store/id1456732565',
      android: 'https://play.google.com/store/apps/details?id=io.zerion.android',
      website: 'https://zerion.io/',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://app.zerion.io/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  slope: {
    name: 'Slope',
    icon: <Logos.Slope />,
    downloadUrls: {
      download: 'https://slope.finance/',
      ios: 'https://apps.apple.com/app/slope-wallet/id1574624530',
      android: 'https://play.google.com/store/apps/details?id=com.wd.wallet',
      chrome: 'https://chrome.google.com/webstore/detail/slope-wallet/pocmplpaccanhmnllbbkpgfliimjljgo',
      website: 'https://slope.finance/',
    },
    getWalletConnectDeeplink: (uri: string) => {
      return `https://slope.finance/app/wc?uri=${encodeURIComponent(uri)}`
    },
  },
  tokenPocket: {
    name: 'TokenPocket Wallet',
    icon: <Logos.TokenPocket />,
    downloadUrls: {
      website: 'https://www.tokenpocket.pro/en/download/app',
      download: 'https://www.tokenpocket.pro/en/download/app',
      android: 'https://play.google.com/store/apps/details?id=vip.mytokenpocket',
      ios: 'https://apps.apple.com/us/app/tp-global-wallet/id6444625622',
      chrome: 'https://chrome.google.com/webstore/detail/tokenpocket/mfgccjchihfkkindfppnaooecgfneiii',
    },
  },
  talisman: {
    name: 'Talisman',
    icon: <Logos.Talisman />,
    downloadUrls: {
      download: 'https://talisman.xyz/download',
      website: 'https://talisman.xyz',
      chrome: 'https://chrome.google.com/webstore/detail/talisman-polkadot-wallet/fijngjgcjhjmmpcmkeiomlglpeiijkld',
      firefox: 'https://addons.mozilla.org/en-US/firefox/addon/talisman-wallet-extension/',
    },
  },
  walletConnect: {
    name: 'Other Wallets',
    shortName: 'Other',
    icon: <Logos.WalletConnect background />,
    iconConnector: <Logos.OtherWallets />,
    iconShape: 'square',
    getWalletConnectDeeplink: (uri: string) => uri,
  },
} as const

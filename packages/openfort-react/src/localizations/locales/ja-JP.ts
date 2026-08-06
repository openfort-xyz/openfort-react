import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const jaJP: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'ウォレットの接続',
  disconnect: '切断',
  connected: '接続されました',
  switchNetworks: 'ネットワークの切り替え',
  chainNetwork: '{{ CHAIN }} ネットワーク',
  copyToClipboard: 'クリップボードにコピー',
  moreInformation: '詳細情報',
  back: '戻る',
  close: '閉じる',
  or: 'または',
  more: 'その他',
  tryAgainQuestion: 'もう一度試しますか？',
  scanTheQRCode: 'QR コードをスキャン',
  useWalletConnectModal: 'WalletConnect モーダルを使用',
  installTheExtension: '拡張機能をインストール',
  approveInWallet: 'ウォレットで承認',
  signIn: 'サインイン',
  signOut: 'サインアウト',
  signedIn: 'サインインしました',
  warnings_walletSwitchingUnsupported: `お使いのウォレットは、このアプリからのネットワークの切り替えをサポートしていません。`,
  warnings_walletSwitchingUnsupportedResolve: `代わりにウォレット内からネットワークを切り替えてみてください。`,
  warnings_walletSwitchingFailed: `ネットワークを切り替えられませんでした。もう一度お試しください。`,
  warnings_chainUnsupported: `このアプリは、現在接続されているネットワークをサポートしていません。`,
  warnings_chainUnsupportedResolve: `切り替えるか切断して続行します。`,

  connectorsScreen_heading: `ウォレットの接続`,
  mobileConnectorsScreen_heading: `ウォレットを選択`,

  scanScreen_heading: `電話でスキャンする`,
  scanScreen_heading_withConnector: `{{ CONNECTORNAME }}でスキャンする`,
  downloadAppScreen_heading: `{{ CONNECTORNAME }} を取得`,
  downloadAppScreen_iosAndroid: `携帯電話のカメラでスキャンして、iOS または Android にダウンロードします。`,
  downloadAppScreen_ios: `携帯電話のカメラでスキャンして、iOS にダウンロードします。`,
  downloadAppScreen_android: `携帯電話のカメラでスキャンして、Android にダウンロードします。`,

  injectionScreen_unavailable_h1: `サポートされていないブラウザ`,
  injectionScreen_unavailable_p: `{{ CONNECTORSHORTNAME }} ウォレットを接続するには、{{ SUGGESTEDEXTENSIONBROWSER }} に拡張機能をインストールします。`,

  injectionScreen_install_h1: `{{ CONNECTORNAME }} をインストール`,
  injectionScreen_install_p: `{{ CONNECTORSHORTNAME }} ウォレットを接続するには、ブラウザ拡張機能をインストールします。`,

  injectionScreen_connecting_h1: `接続を要求`,
  injectionScreen_connecting_p: `{{ CONNECTORSHORTNAME }} ブラウザ拡張機能を 開いて、ウォレットを接続します。`,
  injectionScreen_connecting_injected_h1: `接続を要求`,
  injectionScreen_connecting_injected_p: `このアプリに接続するには、ウォレットを介して要求を受け入れます。`,

  injectionScreen_rejected_h1: `要求がキャンセルされました`,
  injectionScreen_rejected_p: `要求をキャンセルしました。上をクリックしてもう一度お試しください。`,

  injectionScreen_failed_h1: `接続に失敗しました`,
  injectionScreen_failed_p: `申し訳ありませんが、問題が発生しました。もう一度接続してみてください。`,

  injectionScreen_notconnected_h1: `{{ CONNECTORNAME }} にログイン`,
  injectionScreen_notconnected_p: `続行するには、 {{ CONNECTORNAME }} 拡張機能にログインしてください。`,

  profileScreen_heading: '接続されました',

  switchNetworkScreen_heading: 'ネットワークの切り替え',
}

export default jaJP

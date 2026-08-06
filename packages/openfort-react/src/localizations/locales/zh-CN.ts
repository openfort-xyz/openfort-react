import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const zhCN: LocaleProps = {
  ...enUS, // fallback
  connectWallet: '绑定钱包',
  disconnect: '解除绑定',
  connected: '已绑定',
  switchNetworks: '切换网络',
  chainNetwork: '{{ CHAIN }}网络',
  copyToClipboard: '复制到剪贴板',
  moreInformation: '更多信息',
  back: '返回',
  close: '关闭',
  or: '或',
  more: '更多',
  tryAgainQuestion: '重试？',
  scanTheQRCode: '扫描二维码',
  useWalletConnectModal: '使用 WalletConnect 模态窗',
  installTheExtension: '安装扩展程序',
  approveInWallet: '在钱包中批准',
  signIn: '登录',
  signOut: '登出',
  signedIn: '已登录',
  warnings_walletSwitchingUnsupported: `您的钱包不支持从此应用切换网络。`,
  warnings_walletSwitchingUnsupportedResolve: `请尝试从钱包中切换网络。`,
  warnings_walletSwitchingFailed: `无法切换网络，请重试。`,
  warnings_chainUnsupported: `此应用不支持当前连接的网络。`,
  warnings_chainUnsupportedResolve: `请切换网络或断开连接以继续。`,

  connectorsScreen_heading: `绑定钱包`,
  mobileConnectorsScreen_heading: `选择钱包`,

  scanScreen_heading: `手机扫描`,
  scanScreen_heading_withConnector: `手机扫描{{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `获取{{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `使用手机相机扫描以下载 iOS 或 Android 应用。`,
  downloadAppScreen_ios: `使用手机相机扫描以下载 iOS 应用。`,
  downloadAppScreen_android: `使用手机相机扫描以下载 Android 应用。`,

  injectionScreen_unavailable_h1: `不支持的浏览器`,
  injectionScreen_unavailable_p: `要绑定您的{{ CONNECTORSHORTNAME }}钱包，请在{{ SUGGESTEDEXTENSIONBROWSER }}上安装此扩展程序。`,

  injectionScreen_install_h1: `安装{{ CONNECTORNAME }}`,
  injectionScreen_install_p: `要绑定您的{{ CONNECTORSHORTNAME }}钱包，请安装此浏览器扩展程序。`,

  injectionScreen_connecting_h1: `请求绑定`,
  injectionScreen_connecting_p: `打开{{ CONNECTORSHORTNAME }}浏览器 扩展程序以绑定您的钱包。`,
  injectionScreen_connecting_injected_h1: `请求绑定`,
  injectionScreen_connecting_injected_p: `通过您的钱包接受请求，以绑定到此应用。`,

  injectionScreen_rejected_h1: `请求已取消`,
  injectionScreen_rejected_p: `您已取消请求。点击上面可重试。`,

  injectionScreen_failed_h1: `绑定失败`,
  injectionScreen_failed_p: `抱歉，发生错误。请尝试重新绑定。`,

  injectionScreen_notconnected_h1: `登录{{ CONNECTORNAME }}`,
  injectionScreen_notconnected_p: `要继续，请登录到您的{{ CONNECTORNAME }}扩展程序。`,

  profileScreen_heading: '已绑定',

  switchNetworkScreen_heading: '切换网络',
}

export default zhCN

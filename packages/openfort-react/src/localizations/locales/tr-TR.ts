import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const trTR: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'Cüzdan Bağla',
  disconnect: 'Bağlantıyı Kes',
  connected: 'Bağlandı',
  switchNetworks: 'Ağ Değiştir',
  chainNetwork: '{{ CHAIN }} Ağı',
  copyToClipboard: 'Panoya Kopyala',
  moreInformation: 'Daha Fazla Bilgi',
  back: 'Geri',
  close: 'Kapat',
  or: 'veya',
  more: 'Daha Fazla',
  tryAgainQuestion: 'Tekrar Dene?',
  scanTheQRCode: 'Karekodu tarat',
  useWalletConnectModal: 'WalletConnect Modalini Kullan ',
  installTheExtension: 'Eklentiyi İndir',
  approveInWallet: 'Cüzdanda Yetki Ver',
  signIn: 'Giriş Yap',
  signOut: 'Çıkış Yap',
  signedIn: 'Giriş Yapıldı',
  warnings_walletSwitchingUnsupported: `Bu uygulamada ağ değiştirmeyi cüzdanın desteklemiyor.`,
  warnings_walletSwitchingUnsupportedResolve: `Bunun yerine cüzdanınızdan ağları değiştirmeyi deneyin.`,
  warnings_walletSwitchingFailed: `Ağ değiştirilemedi. Lütfen tekrar deneyin.`,
  warnings_chainUnsupported: `Bu uygulama kullanmış olduğunuz ağı desteklemiyor.`,
  warnings_chainUnsupportedResolve: `Devam etmek için ağ değiştir veya bağlantıyı kes.`,

  connectorsScreen_heading: `Cüzdan Bağla`,
  mobileConnectorsScreen_heading: `Cüzdan Seç`,

  scanScreen_heading: `Telefon ile Tarat`,
  scanScreen_heading_withConnector: `{{ CONNECTORNAME }} ile tarat`,
  downloadAppScreen_heading: `{{ CONNECTORNAME }} İndir`,
  downloadAppScreen_iosAndroid: `iOS ve Android'e indirmek için telefon kameran ile tarat.`,
  downloadAppScreen_ios: `iOS'a indirmek için telefon kameran ile tarat.`,
  downloadAppScreen_android: `Android'e indirmek için telefon kameran ile tarat.`,

  injectionScreen_unavailable_h1: `Desteklenmeyen Tarayıcı`,
  injectionScreen_unavailable_p: `{{ CONNECTORSHORTNAME }} cüzdanına bağlanmak için\n{{ SUGGESTEDEXTENSIONBROWSER }} üzerinde indirmen gerekiyor.`,

  injectionScreen_install_h1: `{{ CONNECTORNAME }} İndir`,
  injectionScreen_install_p: `{{ CONNECTORSHORTNAME }} cüzdanına bağlanmak için,\ntarayıcı eklentisini indir.`,

  injectionScreen_connecting_h1: `Bağlantı İsteniyor.`,
  injectionScreen_connecting_p: `Cüzdanını bağlamak için\n tarayıcıdan {{ CONNECTORSHORTNAME }} uzantısını açın.`,
  injectionScreen_connecting_injected_h1: `Bağlantı İsteniyor.`,
  injectionScreen_connecting_injected_p: `Bu uygulamaya bağlanmak için cüzdanına gelen isteği kabul et.`,

  injectionScreen_rejected_h1: `İstek iptal edildi.`,
  injectionScreen_rejected_p: `İsteği iptal ettin.\nTekrar denemek için yukarıyı tıklayın.`,

  injectionScreen_failed_h1: `Bağlantı Başarısız`,
  injectionScreen_failed_p: `Üzgünüz, bir şeyler ters gitti.\nLütfen daha sonra tekrar deneyin.`,

  injectionScreen_notconnected_h1: `{{ CONNECTORNAME }} ile giriş yap`,
  injectionScreen_notconnected_p: `Devam etmek için, {{ CONNECTORNAME }} eklentisine giriş yapın.`,

  profileScreen_heading: 'Bağlandı',

  switchNetworkScreen_heading: 'Ağ Değiştir',
}

export default trTR

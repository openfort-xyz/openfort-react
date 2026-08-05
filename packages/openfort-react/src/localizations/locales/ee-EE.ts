import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const eeEE: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'Ühenda rahakott',
  disconnect: 'Katkesta ühendus',
  connected: 'Ühendatud',
  switchNetworks: 'Vaheta võrke',
  chainNetwork: '{{ CHAIN }} Võrk',
  copyToClipboard: 'Kopeeri lõikelauale',
  moreInformation: 'Rohkem infot',
  back: 'Tagasi',
  close: 'Pane kinni',
  or: 'või',
  more: 'Rohkem',
  tryAgainQuestion: 'Proovi uuesti?',
  scanTheQRCode: 'Skaneeri QR-kood',
  useWalletConnectModal: 'Kasuta WalletConnecti modalit',
  installTheExtension: 'Installi laiendust',
  approveInWallet: 'Kiita heaks rahakotis',
  signIn: 'Logi sisse',
  signOut: 'Logi välja',
  signedIn: 'Sisse logitud',
  warnings_walletSwitchingUnsupported: `Teie rahakott ei toeta võrgu vahetamist sellest rakendusest.`,
  warnings_walletSwitchingUnsupportedResolve: `Proovige võrgu vahetamist teha oma rahakoti seest.`,
  warnings_walletSwitchingFailed: `Võrgu vahetamine ebaõnnestus. Palun proovi uuesti.`,
  warnings_chainUnsupported: `See rakendus ei toeta praegu ühendatud võrku.`,
  warnings_chainUnsupportedResolve: `Jätkamiseks vahetage või ühendage lahti.`,

  connectorsScreen_heading: `Ühendage rahakott`,
  mobileConnectorsScreen_heading: `Valige rahakott`,

  scanScreen_heading: `Skaneerige telefoni abil`,
  scanScreen_heading_withConnector: `Skaneerige koos {{ CONNECTORNAME }}-ga`,
  downloadAppScreen_heading: `Hankige {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `Skaneerige oma telefoni kaameraga allalaadimiseks iOS-i või Androidi jaoks.`,
  downloadAppScreen_ios: `Skaneerige oma telefoni kaameraga allalaadimiseks iOS-i jaoks.`,
  downloadAppScreen_android: `Skaneerige oma telefoni kaameraga Androidi allalaadimiseks.`,

  injectionScreen_unavailable_h1: `Toetuseta brauser`,
  injectionScreen_unavailable_p: `Teie {{ CONNECTORSHORTNAME }} rahakoti ühendamiseks\ninstallige laiendus {{ SUGGESTEDEXTENSIONBROWSER }}-le.`,

  injectionScreen_install_h1: `Installige {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `Teie {{ CONNECTORSHORTNAME }} rahakoti ühendamiseks\ninstallige brauseri laiendus.`,

  injectionScreen_connecting_h1: `Ühenduse taotlemine`,
  injectionScreen_connecting_p: `Ava {{ CONNECTORSHORTNAME }} brauseri \nlaiendus rahakoti ühendamiseks.`,
  injectionScreen_connecting_injected_h1: `Ühenduse taotlemine`,
  injectionScreen_connecting_injected_p: `Nõustuge rakendusega ühendamiseks oma rahakotis.`,

  injectionScreen_rejected_h1: `Taotlus tühistatud`,
  injectionScreen_rejected_p: `Tühistasite taotluse.\nKlõpsake ülal, et uuesti proovida.`,

  injectionScreen_failed_h1: `Ühenduse loomine ebaõnnestus`,
  injectionScreen_failed_p: `Vabandame, midagi läks valesti.\nProovige ühendust uuesti luua.`,

  injectionScreen_notconnected_h1: `Logige sisse {{ CONNECTORNAME }}-ga`,
  injectionScreen_notconnected_p: `Jätkamiseks logige sisse oma {{ CONNECTORNAME }} laiendisse.`,

  profileScreen_heading: 'Ühendatud',

  switchNetworkScreen_heading: 'Võrkude vahetamine',
}

export default eeEE

import type { LocaleProps } from '.'
import enUS from './en-US.js'

const caAD: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'Connecta la cartera',
  disconnect: 'Desconnectar',
  connected: 'Connectat',
  switchNetworks: 'Canvi de xarxa',
  chainNetwork: 'Xarxa {{ CHAIN }}',
  copyToClipboard: 'Copia al portapapers',
  moreInformation: 'Més informació',
  back: 'Enrere',
  close: 'Tanca',
  or: 'o',
  more: 'Més',
  tryAgainQuestion: 'Tornar a intentar-ho?',
  scanTheQRCode: 'Escaneja el codi QR',
  useWalletConnectModal: 'Utilitza WalletConnect Modal',
  installTheExtension: "Instal·la l'extensió",
  approveInWallet: 'Aprova a la cartera',
  signIn: 'Inicia sessió',
  signOut: 'Tanca sessió',
  signedIn: 'Sessió iniciada',
  warnings_walletSwitchingUnsupported: `La teva cartera no permet canviar de xarxa des d'aquesta aplicació.`,
  warnings_walletSwitchingUnsupportedResolve: `Prova a canviar de xarxa des de la teva cartera.`,
  warnings_walletSwitchingFailed: `No s'ha pogut canviar de xarxa. Torna-ho a provar.`,
  warnings_chainUnsupported: `Aquesta aplicació no és compatible amb la xarxa connectada actualment.`,
  warnings_chainUnsupportedResolve: `Canvia o desconnecta per continuar.`,

  connectorsScreen_heading: `Connecta una cartera`,
  mobileConnectorsScreen_heading: `Tria una cartera`,

  scanScreen_heading: `Escaneja amb el telèfon`,
  scanScreen_heading_withConnector: `Escaneja amb {{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `Obté {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `Escaneja amb la càmera del teu telèfon per descarregar-la en iOS o Android.`,
  downloadAppScreen_ios: `Escaneja amb la càmera del teu telèfon per descarregar-la en iOS.`,
  downloadAppScreen_android: `Escaneja amb la càmera del teu telèfon per descarregar-la en Android.`,

  injectionScreen_unavailable_h1: `Navegador no compatible`,
  injectionScreen_unavailable_p: `Per connectar la teva cartera de {{ CONNECTORSHORTNAME }}, instal·la l'extensió en {{ SUGGESTEDEXTENSIONBROWSER }}.`,

  injectionScreen_install_h1: `Instal·la {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `Per connectar la teva cartera de {{ CONNECTORSHORTNAME }}, instal·la l'extensió del navegador.`,

  injectionScreen_connecting_h1: `Sol·licitud de connexió`,
  injectionScreen_connecting_p: `Obre l'extensió del navegador de {{ CONNECTORSHORTNAME }}  per connectar la teva cartera.`,

  injectionScreen_connecting_injected_h1: `Sol·licitud de connexió`,
  injectionScreen_connecting_injected_p: `Accepta la sol·licitud a través de la teva cartera per connectar-te a aquesta aplicació.`,

  injectionScreen_rejected_h1: `Sol·licitud cancel·lada`,
  injectionScreen_rejected_p: `Has cancel·lat la sol·licitud. Fes clic a dalt per tornar-ho a intentar.`,

  injectionScreen_failed_h1: `Error de connexió`,
  injectionScreen_failed_p: `Ho sentim, hi ha hagut un problema. Intenta connectar-te de nou.`,

  injectionScreen_notconnected_h1: `Inicia sessió en {{ CONNECTORNAME }}`,
  injectionScreen_notconnected_p: `Per continuar, inicia sessió en la teva extensió de {{ CONNECTORNAME }}.`,

  profileScreen_heading: 'Connectat',

  switchNetworkScreen_heading: 'Canvi de xarxa',
}

export default caAD

import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const esES: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'Conecta una cartera',
  disconnect: 'Desconectar',
  connected: 'Conectado',
  switchNetworks: 'Cambio de red',
  chainNetwork: 'Red {{ CHAIN }}',
  copyToClipboard: 'Copiar al portapapeles',
  moreInformation: 'Más información',
  back: 'Atrás',
  close: 'Cerrar',
  or: 'o',
  more: 'Más',
  tryAgainQuestion: '¿Intentar de nuevo?',
  scanTheQRCode: 'Escanea el código QR',
  useWalletConnectModal: 'Utilizar WalletConnect Modal',
  installTheExtension: 'Instalar la extensión',
  approveInWallet: 'Aprobar en la cartera',
  signIn: 'Iniciar sesión',
  signOut: 'Cerrar sesión',
  signedIn: 'Sesión iniciada',
  warnings_walletSwitchingUnsupported: `Tu cartera no permite cambiar de red desde esta aplicación.`,
  warnings_walletSwitchingUnsupportedResolve: `Prueba a cambiar de red desde tu cartera.`,
  warnings_walletSwitchingFailed: `No se pudo cambiar de red. Inténtalo de nuevo.`,
  warnings_chainUnsupported: `Esta aplicación no es compatible con la red conectada actualmente.`,
  warnings_chainUnsupportedResolve: `Cambia o desconecta para continuar.`,

  connectorsScreen_heading: `Conecta una cartera`,
  mobileConnectorsScreen_heading: `Elige una cartera`,

  scanScreen_heading: `Escanea con el teléfono`,
  scanScreen_heading_withConnector: `Escanea con {{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `Obtén {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `Escanea con la cámara de tu teléfono para descargarla en iOS o Android.`,
  downloadAppScreen_ios: `Escanea con la cámara de tu teléfono para descargarla en iOS.`,
  downloadAppScreen_android: `Escanea con la cámara de tu teléfono para descargarla en Android.`,

  injectionScreen_unavailable_h1: `Navegador no compatible`,
  injectionScreen_unavailable_p: `Para conectar tu cartera de {{ CONNECTORSHORTNAME }}, instala la extensión en {{ SUGGESTEDEXTENSIONBROWSER }}.`,

  injectionScreen_install_h1: `Instala {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `Para conectar tu cartera de {{ CONNECTORSHORTNAME }}, instala la extensión del navegador.`,

  injectionScreen_connecting_h1: `Solicitud de conexión`,
  injectionScreen_connecting_p: `Abre la extensión del navegador de {{ CONNECTORSHORTNAME }}  para conectar tu cartera.`,
  injectionScreen_connecting_injected_h1: `Solicitud de conexión`,
  injectionScreen_connecting_injected_p: `Acepta la solicitud a través de tu cartera para conectarte a esta aplicación.`,

  injectionScreen_rejected_h1: `Solicitud cancelada`,
  injectionScreen_rejected_p: `Has cancelado la solicitud. Haz clic arriba para intentarlo de nuevo.`,

  injectionScreen_failed_h1: `Error de conexión`,
  injectionScreen_failed_p: `Lo sentimos, ha habido un problema. Intenta conectarte de nuevo.`,

  injectionScreen_notconnected_h1: `Inicia sesión en {{ CONNECTORNAME }}`,
  injectionScreen_notconnected_p: `Para continuar, inicia sesión en tu extensión de {{ CONNECTORNAME }}.`,

  profileScreen_heading: 'Conectado',

  switchNetworkScreen_heading: 'Cambio de red',
}

export default esES

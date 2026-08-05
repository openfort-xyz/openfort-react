import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const frFR: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'Connecter le portefeuille',
  disconnect: 'Déconnecter',
  connected: 'Connecté',
  switchNetworks: 'Changer de réseau',
  chainNetwork: 'Réseau {{ CHAIN }}',
  copyToClipboard: 'Copier dans le presse-papiers',
  moreInformation: 'Plus d’informations',
  back: 'Retour',
  close: 'Fermer',
  or: 'ou',
  more: 'Plus',
  tryAgainQuestion: 'Réessayer ?',
  scanTheQRCode: 'Scannez le code QR',
  useWalletConnectModal: 'Utiliser la modale WalletConnect',
  installTheExtension: 'Installer l’extension',
  approveInWallet: 'Approuver dans le portefeuille',
  signIn: 'Se connecter',
  signOut: 'Se déconnecter',
  signedIn: 'Connecté',
  warnings_walletSwitchingUnsupported: `Votre portefeuille ne prend pas en charge le changement de réseau à partir de cette application.`,
  warnings_walletSwitchingUnsupportedResolve: `Essayez plutôt de changer de réseau à partir de votre portefeuille.`,
  warnings_walletSwitchingFailed: `Impossible de changer de réseau. Veuillez réessayer.`,
  warnings_chainUnsupported: `Cette application ne prend pas en charge le réseau connecté actuel.`,
  warnings_chainUnsupportedResolve: `Changez ou déconnectez-vous pour continuer.`,

  connectorsScreen_heading: `Connectez le portefeuille`,
  mobileConnectorsScreen_heading: `Choisissez le portefeuille`,

  scanScreen_heading: `Scannez avec le téléphone`,
  scanScreen_heading_withConnector: `Scannez avec {{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `Obtenez {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `Scannez avec l'appareil photo de votre téléphone pour le télécharger sur iOS ou Android.`,
  downloadAppScreen_ios: `Scannez avec l'appareil photo de votre téléphone pour le télécharger sur iOS.`,
  downloadAppScreen_android: `Scannez avec l'appareil photo de votre téléphone pour le télécharger sur Android.`,

  injectionScreen_unavailable_h1: `Navigateur non pris en charge`,
  injectionScreen_unavailable_p: `Pour connecter votre portefeuille {{ CONNECTORSHORTNAME }}, installez l’extension sur {{ SUGGESTEDEXTENSIONBROWSER }}.`,

  injectionScreen_install_h1: `Installez {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `Pour connecter votre portefeuille {{ CONNECTORSHORTNAME }}, installez l’extension de navigateur.`,

  injectionScreen_connecting_h1: `Demande de connexion`,
  injectionScreen_connecting_p: `Ouvrez l’extension de navigateur {{ CONNECTORSHORTNAME }} pour connecter votre portefeuille.`,
  injectionScreen_connecting_injected_h1: `Demande de connexion`,
  injectionScreen_connecting_injected_p: `Acceptez la demande via votre portefeuille pour vous connecter à cette application.`,

  injectionScreen_rejected_h1: `Demande annulée`,
  injectionScreen_rejected_p: `Vous avez annulé la demande. Cliquez ci-dessus pour réessayer.`,

  injectionScreen_failed_h1: `Échec de la connexion`,
  injectionScreen_failed_p: `Malheureusement, un problème est survenu. Veuillez réessayer de vous connecter.`,

  injectionScreen_notconnected_h1: `Connectez-vous à {{ CONNECTORNAME }}`,
  injectionScreen_notconnected_p: `Pour continuer, veuillez vous connecter à votre extension {{ CONNECTORNAME }} .`,

  profileScreen_heading: 'Connecté',

  switchNetworkScreen_heading: 'Changer de réseau',
}

export default frFR

import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const ptBR: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'Conectar carteira',
  disconnect: 'Desconectar',
  connected: 'Conectado',
  switchNetworks: 'Alternar rede',
  chainNetwork: 'Rede {{ CHAIN }}',
  copyToClipboard: 'Copiar para a área de transferência',
  moreInformation: 'Mais informações',
  back: 'Voltar',
  close: 'Fechar',
  or: 'ou',
  more: 'Mais',
  tryAgainQuestion: 'Tentar novamente?',
  scanTheQRCode: 'Escaneie o código QR',
  useWalletConnectModal: 'Use o modal do WalletConnect',
  installTheExtension: 'Instale a extensão',
  approveInWallet: 'Aprovar na carteira',
  signIn: 'Entrar',
  signOut: 'Sair',
  signedIn: 'Conectado',
  warnings_walletSwitchingUnsupported: `A sua carteira não permite a troca de rede a partir deste aplicativo.`,
  warnings_walletSwitchingUnsupportedResolve: `Tente trocar de rede de dentro da sua carteira.`,
  warnings_walletSwitchingFailed: `Não foi possível trocar de rede. Tente novamente.`,

  warnings_chainUnsupported: `Este aplicativo não é compatível com a rede conectada.`,
  warnings_chainUnsupportedResolve: `Altere a rede ou desconecte para continuar.`,

  connectorsScreen_heading: `Conectar carteira`,
  mobileConnectorsScreen_heading: `Escolha uma carteira`,

  scanScreen_heading: `Escanear com o celular`,
  scanScreen_heading_withConnector: `Escanear com o {{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `Obter {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `Escaneie com a câmera do seu celular para baixar no iOS ou Android.`,
  downloadAppScreen_ios: `Escaneie com a câmera do seu celular para baixar no iOS.`,
  downloadAppScreen_android: `Escaneie com a câmera do seu celular para baixar no Android.`,

  injectionScreen_unavailable_h1: `Navegador não compatível`,
  injectionScreen_unavailable_p: `Para conectar sua carteira {{ CONNECTORSHORTNAME }},\ninstale a extensão no {{ SUGGESTEDEXTENSIONBROWSER }}.`,

  injectionScreen_install_h1: `Instalar {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `Para conectar sua carteira {{ CONNECTORSHORTNAME }},\ninstale a extensão do navegador`,

  injectionScreen_connecting_h1: `Solicitando conexão`,
  injectionScreen_connecting_p: `Abra a extensão do navegador do {{ CONNECTORSHORTNAME }} \npara conectar a sua carteira.`,

  injectionScreen_connecting_injected_h1: `Solicitando conexão`,
  injectionScreen_connecting_injected_p: `Aceite a solicitação por meio de sua carteira para se conectar a este aplicativo.`,

  injectionScreen_rejected_h1: `Solicitação cancelada`,
  injectionScreen_rejected_p: `Você cancelou a solicitação.\nClique acima para tentar novamente.`,

  injectionScreen_failed_h1: `A conexão falhou`,
  injectionScreen_failed_p: `Desculpe, ocorreu um erro.\nPor favor, tente conectar novamente.`,

  injectionScreen_notconnected_h1: `Faça login no {{ CONNECTORNAME }}`,
  injectionScreen_notconnected_p: `Para continuar, faça login na sua extensão do {{ CONNECTORNAME }}.`,

  profileScreen_heading: 'Conectado',

  switchNetworkScreen_heading: 'Alternar rede',
}

export default ptBR

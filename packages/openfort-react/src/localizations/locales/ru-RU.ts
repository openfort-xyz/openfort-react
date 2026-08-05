import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const ruRU: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'Подключить кошелек',
  disconnect: 'Отключить',
  connected: 'Подключена',
  switchNetworks: 'Переключение сети',
  chainNetwork: 'Сеть {{ CHAIN }}',
  copyToClipboard: 'Скопировать в буфер обмена',
  moreInformation: 'Больше информации',
  back: 'Назад',
  close: 'Закрыть',
  or: 'или',
  more: 'Еще',
  tryAgainQuestion: 'Попробовать снова?',
  scanTheQRCode: 'Отсканируйте QR-код',
  useWalletConnectModal: 'Использовать окно WalletConnect',
  installTheExtension: 'Установить расширение',
  approveInWallet: 'Подтвердите',
  signIn: 'Войти',
  signOut: 'Выйти',
  signedIn: 'Вошли',
  warnings_walletSwitchingUnsupported: `Ваш кошелек не поддерживает переключение сетей из этого приложения.`,
  warnings_walletSwitchingUnsupportedResolve: `Попробуйте переключиться на другую сеть прямо в вашем кошельке.`,
  warnings_walletSwitchingFailed: `Не удалось сменить сеть. Попробуйте ещё раз.`,
  warnings_chainUnsupported: `Это приложение не поддерживает текущую подключенную сеть.`,
  warnings_chainUnsupportedResolve: `Для продолжения переключите сеть или отключите кошелек.`,

  connectorsScreen_heading: `Подключение кошелька`,
  mobileConnectorsScreen_heading: `Выберите кошелек`,

  scanScreen_heading: `Сканирование с телефона`,
  scanScreen_heading_withConnector: `Сканирование с помощью {{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `Скачивание {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `Отсканируйте камерой телефона для загрузки приложения на iOS или Android.`,
  downloadAppScreen_ios: `Отсканируйте камерой телефона для загрузки приложения на iOS.`,
  downloadAppScreen_android: `Сканируйте камерой телефона для загрузки приложения на Android.`,

  injectionScreen_unavailable_h1: `Неподдерживаемый браузер`,
  injectionScreen_unavailable_p: `Для подключения вашего кошелька {{ CONNECTORSHORTNAME }}, установите расширение для браузера {{ SUGGESTEDEXTENSIONBROWSER }}.`,

  injectionScreen_install_h1: `Установите {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `Для подключения вашего кошелька {{ CONNECTORSHORTNAME }}, установите расширение для браузера.`,

  injectionScreen_connecting_h1: `Запрос на подключение`,
  injectionScreen_connecting_p: `Откройте расширение для браузера {{ CONNECTORSHORTNAME }} для подключения вашего кошелька.`,
  injectionScreen_connecting_injected_h1: `Запрос на подключение`,
  injectionScreen_connecting_injected_p: `Примите запрос в вашем кошельке, чтобы подключиться к приложению.`,

  injectionScreen_rejected_h1: `Запрос отменен`,
  injectionScreen_rejected_p: `Вы отменили запрос.\nНажмите выше, чтобы попробовать снова.`,

  injectionScreen_failed_h1: `Сбой подключения`,
  injectionScreen_failed_p: `Извините, что-то пошло не так.\nПожалуйста, попробуйте подключиться снова.`,

  injectionScreen_notconnected_h1: `Войдите в {{ CONNECTORNAME }}`,
  injectionScreen_notconnected_p: `Для продолжения войдите в расширение {{ CONNECTORNAME }}.`,

  profileScreen_heading: 'Кошелек подключен',

  switchNetworkScreen_heading: 'Переключение сетей',
}

export default ruRU

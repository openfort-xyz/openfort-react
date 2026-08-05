import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const faIR: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'اتصال به کیف پول',
  disconnect: 'قطع ارتباط',
  connected: 'متصل شد',
  switchNetworks: 'تغییر شبکه‌ها',
  chainNetwork: '{{ CHAIN }} شبکه',
  copyToClipboard: 'کپی به کلیپ‌بورد',
  moreInformation: 'اطلاعات بیشتر',
  back: 'بازگشت',
  close: 'بستن',
  or: 'یا',
  more: 'بیشتر',
  tryAgainQuestion: 'آیا دوباره تلاش کنیم؟',
  scanTheQRCode: 'اسکن کیو‌آر کد',
  useWalletConnectModal: 'استفاده از مودال والت‌‌کانکت',
  installTheExtension: 'نصب افزونه',
  approveInWallet: 'در کیف پول تأیید کنید',
  signIn: 'ورود',
  signOut: 'خروج',
  signedIn: 'وارد شده',
  warnings_walletSwitchingUnsupported: `متاسفانه، کیف پول شما از تغییر شبکه در این برنامه پشتیبانی نمی‌کند.`,
  warnings_walletSwitchingUnsupportedResolve: `بهتر است از داخل کیف پول خود تغییر شبکه دهید.`,
  warnings_walletSwitchingFailed: `تغییر شبکه ممکن نشد. لطفاً دوباره تلاش کنید.`,
  warnings_chainUnsupported: `این برنامه با شبکه‌ای که در حال حاضر متصل است، سازگاری ندارد.`,
  warnings_chainUnsupportedResolve: `برای ادامه، شبکه را تغییر دهید یا اتصال را قطع کنید.`,

  connectorsScreen_heading: `برقراری ارتباط با کیف پول`,
  mobileConnectorsScreen_heading: `انتخاب کیف پول`,

  scanScreen_heading: `اسکن با گوشی`,
  scanScreen_heading_withConnector: `اسکن با {{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `دریافت {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `از دوربین گوشی خود برای اسکن و دریافت نسخه iOS یا Android استفاده کنید.`,
  downloadAppScreen_ios: `از دوربین گوشی خود برای دریافت نسخه iOS استفاده کنید.`,
  downloadAppScreen_android: `از دوربین گوشی خود برای دریافت نسخه Android استفاده کنید.`,

  injectionScreen_unavailable_h1: `مرورگر پشتیبانی نمی‌شود`,
  injectionScreen_unavailable_p: `برای برقراری ارتباط با کیف پول {{ CONNECTORSHORTNAME }}، افزونه مرورگر را در {{ SUGGESTEDEXTENSIONBROWSER }} نصب کنید.`,

  injectionScreen_install_h1: `نصب {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `برای برقراری ارتباط با کیف پول {{ CONNECTORSHORTNAME }}، افزونه مرورگر را نصب کنید.`,

  injectionScreen_connecting_h1: `درخواست اتصال`,
  injectionScreen_connecting_p: `افزونه مرورگر {{ CONNECTORSHORTNAME }} را باز کنید تا ارتباط با کیف پول ایجاد شود.`,
  injectionScreen_connecting_injected_h1: `درخواست اتصال`,
  injectionScreen_connecting_injected_p: `درخواست را از طریق کیف پول خود بپذیرید تا به این برنامه متصل شوید.`,

  injectionScreen_rejected_h1: `درخواست لغو شد`,
  injectionScreen_rejected_p: `شما درخواست را لغو کرده‌اید. برای تلاش مجدد، بالا کلیک کنید.`,

  injectionScreen_failed_h1: `ارتباط ناموفق`,
  injectionScreen_failed_p: `متاسفانه، مشکلی بوجود آمد. لطفاً مجدداً اتصال برقرار کنید.`,

  injectionScreen_notconnected_h1: `با ورود به {{ CONNECTORNAME }} وارد شوید`,
  injectionScreen_notconnected_p: `برای ادامه، لطفاً وارد افزونه {{ CONNECTORNAME }} خود شوید.`,

  profileScreen_heading: 'اتصال‌ها',

  switchNetworkScreen_heading: 'تغییر شبکه‌ها',
}

export default faIR

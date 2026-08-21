import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const arAE: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'الاتصال بالمحفظة',
  disconnect: 'قطع الاتصال',
  connected: 'متصل',
  switchNetworks: 'تغيير الشبكات',
  chainNetwork: 'شبكة {{ CHAIN }}',
  copyToClipboard: 'نسخ إلى الحافظة',
  moreInformation: 'مزيد من المعلومات',
  back: 'عودة',
  close: 'إغلاق',
  or: 'أو',
  more: 'المزيد',
  tryAgainQuestion: 'هل نحاول مرة أخرى؟',
  scanTheQRCode: 'مسح رمز الاستجابة السريعة',
  useWalletConnectModal: 'استخدم نموذج ولِيت‌كنيكت',
  installTheExtension: 'تثبيت الإضافة',
  approveInWallet: 'الموافقة في المحفظة',
  signIn: 'تسجيل الدخول',
  signOut: 'تسجيل الخروج',
  signedIn: 'تم تسجيل الدخول',
  warnings_walletSwitchingUnsupported: `عذرًا، لا تدعم محفظتك تغيير الشبكات من هذا التطبيق.`,
  warnings_walletSwitchingUnsupportedResolve: `حاول تغيير الشبكات من داخل محفظتك بدلاً من ذلك.`,
  warnings_walletSwitchingFailed: `تعذّر تبديل الشبكة. يُرجى المحاولة مرة أخرى.`,
  warnings_chainUnsupported: `هذا التطبيق غير متوافق مع الشبكة المتصلة حاليًا.`,
  warnings_chainUnsupportedResolve: `للمتابعة، قم بتغيير الشبكة أو قطع الاتصال.`,

  connectorsScreen_heading: `الاتصال بالمحفظة`,
  mobileConnectorsScreen_heading: `اختر محفظة`,

  scanScreen_heading: `مسح باستخدام الهاتف`,
  scanScreen_heading_withConnector: `مسح باستخدام {{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `الحصول على {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `استخدم كاميرا هاتفك للمسح وتنزيله على نظامي iOS أو Android

.`,
  downloadAppScreen_ios: `استخدم كاميرا هاتفك للمسح وتنزيله على نظام iOS.`,
  downloadAppScreen_android: `استخدم كاميرا هاتفك للمسح وتنزيله على نظام Android.`,

  injectionScreen_unavailable_h1: `المتصفح غير مدعوم`,
  injectionScreen_unavailable_p: `لتوصيل محفظتك {{ CONNECTORSHORTNAME }}، قم بتثبيت الإضافة على متصفح {{ SUGGESTEDEXTENSIONBROWSER }}.`,

  injectionScreen_install_h1: `تثبيت {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `لتوصيل محفظتك {{ CONNECTORSHORTNAME }}، قم بتثبيت الإضافة على المتصفح.`,

  injectionScreen_connecting_h1: `طلب الاتصال`,
  injectionScreen_connecting_p: `افتح إضافة المتصفح {{ CONNECTORSHORTNAME }} لتوصيل محفظتك.`,
  injectionScreen_connecting_injected_h1: `طلب الاتصال`,
  injectionScreen_connecting_injected_p: `قبل الطلب من خلال محفظتك للاتصال بتطبيقنا.`,

  injectionScreen_rejected_h1: `تم رفض الطلب`,
  injectionScreen_rejected_p: `لقد قمت برفض الطلب. انقر أعلى للمحاولة مرة أخرى.`,

  injectionScreen_failed_h1: `فشل الاتصال`,
  injectionScreen_failed_p: `عذرًا، حدث خطأ ما. يُرجى المحاولة مرة أخرى للاتصال.`,

  injectionScreen_notconnected_h1: `تسجيل الدخول إلى {{ CONNECTORNAME }}`,
  injectionScreen_notconnected_p: `للمتابعة، يُرجى تسجيل الدخول إلى إضافة {{ CONNECTORNAME }}.`,

  profileScreen_heading: 'متصل',

  switchNetworkScreen_heading: 'تبديل الشبكات',
}

export default arAE

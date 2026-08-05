import enUS from './en-US.js'
import type { LocaleProps } from './index.js'

const viVN: LocaleProps = {
  ...enUS, // fallback
  connectWallet: 'Kết nối ví',
  disconnect: 'Ngắt kết nối',
  connected: 'Đã kết nối',
  switchNetworks: 'Đổi mạng',
  chainNetwork: 'Mạng {{ CHAIN }}',
  copyToClipboard: 'Sao chép',
  moreInformation: 'Thêm thông tin',
  back: 'Quay lại',
  close: 'Đóng',
  or: 'hoặc',
  more: 'Thêm',
  tryAgainQuestion: 'Thử lại?',
  scanTheQRCode: 'Quét mã QR',
  useWalletConnectModal: 'Dùng WalletConnect Modal',
  installTheExtension: 'Cài tiện ích',
  approveInWallet: 'Cấp quyền trong ví',
  signIn: 'Đăng nhập',
  signOut: 'Đăng xuất',
  signedIn: 'Đã đăng nhập',
  warnings_walletSwitchingUnsupported: `Ví của bạn không hỗ trợ đổi mạng từ ứng dụng.`,
  warnings_walletSwitchingUnsupportedResolve: `Hãy thử đổi mạng từ phía ví của bạn.`,
  warnings_walletSwitchingFailed: `Không thể chuyển mạng. Vui lòng thử lại.`,
  warnings_chainUnsupported: `Ứng dụng này không hỗ trợ mạng hiện tại.`,
  warnings_chainUnsupportedResolve: `Đổi hoặc ngắt kết nối để tiếp tục.`,

  connectorsScreen_heading: `Kết nối Ví`,
  mobileConnectorsScreen_heading: `Chọn ví`,

  scanScreen_heading: `Scan bằng điện thoại`,
  scanScreen_heading_withConnector: `Quét với {{ CONNECTORNAME }}`,
  downloadAppScreen_heading: `Lấy {{ CONNECTORNAME }}`,
  downloadAppScreen_iosAndroid: `Quét bằng camera trên điện thoại của bạn để tải về cho iOS hoặc Android.`,
  downloadAppScreen_ios: `Quét bằng camera trên điện thoại ủa bạn để tải về cho iOS.`,
  downloadAppScreen_android: `Quét bằng camera trên điện thoại ủa bạn để tải về cho Android.`,

  injectionScreen_unavailable_h1: `Trình duyệt không được hỗ trợ`,
  injectionScreen_unavailable_p: `Để kết nối ví {{ CONNECTORSHORTNAME }} của bạn,\ncài đặt tiện ích trên {{ SUGGESTEDEXTENSIONBROWSER }}.`,

  injectionScreen_install_h1: `Cài {{ CONNECTORNAME }}`,
  injectionScreen_install_p: `Để kết nối ví {{ CONNECTORSHORTNAME }},\ncài đặt tiện ích trên trình duyệt.`,

  injectionScreen_connecting_h1: `Đang yêu cầu kết nối`,
  injectionScreen_connecting_p: `Mở tiện ích {{ CONNECTORSHORTNAME }} \n trên trình duyệt để kết nối.`,
  injectionScreen_connecting_injected_h1: `Đang yêu cầu kết nối`,
  injectionScreen_connecting_injected_p: `Đồng ý yêu cầu từ phía ví của bạn để kết nối ứng dụng này.`,

  injectionScreen_rejected_h1: `Đã hủy yêu cầu`,
  injectionScreen_rejected_p: `Bạn vừa hủy yêu cầu.\nNhấn phía trên để thử lại.`,

  injectionScreen_failed_h1: `Kết nối không thành công`,
  injectionScreen_failed_p: `Xin lỗi, có gì đó không đúng.\nVui lòng thử lại.`,

  injectionScreen_notconnected_h1: `Đăng nhập vào {{ CONNECTORNAME }}`,
  injectionScreen_notconnected_p: `Để tiếp tục, vui lòng đăng nhập bằng tiện ích {{ CONNECTORNAME }}.`,

  profileScreen_heading: 'Đã kết nối',

  switchNetworkScreen_heading: 'Đổi mạng',
}

export default viVN

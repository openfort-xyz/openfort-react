'use client'

import useLocales from '../../../hooks/useLocales.js'
import { useExternalConnector } from '../../../wallets/useExternalConnectors.js'
import CustomQRCode from '../../Common/CustomQRCode/index.js'
import { ModalBody, ModalContent } from '../../Common/Modal/styles.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'

const DownloadApp = () => {
  const context = useOpenfort()
  const wallet = useExternalConnector(context.connector.id)

  const locales = useLocales({
    CONNECTORNAME: wallet?.name ?? 'UNKNOWN CONNECTOR',
  })

  if (!wallet) return <>Wallet not found</>

  const downloads = {
    ios: wallet.downloadUrls?.ios,
    android: wallet.downloadUrls?.android,
    redirect: wallet.downloadUrls?.download,
  }

  const bodycopy =
    downloads.ios && downloads.android
      ? locales.downloadAppScreen_iosAndroid
      : downloads.ios
        ? locales.downloadAppScreen_ios
        : locales.downloadAppScreen_android

  return (
    <PageContent>
      <ModalContent style={{ paddingBottom: 4, gap: 14 }}>
        {downloads.redirect && <CustomQRCode value={downloads.redirect} />}
        {!downloads.redirect && <>No download link available</>}
        <ModalBody style={{ fontSize: 15, lineHeight: '20px', padding: '0 12px' }}>{bodycopy}</ModalBody>
      </ModalContent>
    </PageContent>
  )
}

export default DownloadApp

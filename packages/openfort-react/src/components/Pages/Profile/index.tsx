'use client'

import { useEffect, useState } from 'react'

import { DisconnectIcon, GuestIcon, KeyIcon } from '../../../assets/icons.js'
import useLocales from '../../../hooks/useLocales.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { LargeButton } from '../../Common/LargeButton/index.js'
import { ModalContent, ModalHeading } from '../../Common/Modal/styles.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { DisconnectButton } from '../Connected/styles.js'

const Profile: React.FC = () => {
  const { setOpen, setRoute } = useOpenfort()
  const logout = useOpenfortCore((s) => s.logout)

  const locales = useLocales()

  const [shouldDisconnect, setShouldDisconnect] = useState(false)

  useEffect(() => {
    if (!shouldDisconnect) return

    // Close before disconnecting to avoid layout shifting while modal is still open
    setOpen(false)
    return () => {
      logout()
    }
  }, [shouldDisconnect, setOpen, logout])

  return (
    <PageContent onBack={routes.CONNECTED}>
      <ModalContent>
        <ModalHeading>Profile</ModalHeading>
        {/* <ModalBody>Manage your profile.</ModalBody> */}
        <div>
          <LargeButton
            onClick={() => {
              setRoute(routes.LINKED_PROVIDERS)
            }}
            icon={<GuestIcon />}
          >
            Authentication methods
          </LargeButton>
          <LargeButton
            onClick={() => {
              setRoute(routes.EXPORT_KEY)
            }}
            icon={<KeyIcon />}
          >
            Export key
          </LargeButton>
        </div>
      </ModalContent>
      <DisconnectButton onClick={() => setShouldDisconnect(true)} icon={<DisconnectIcon />}>
        {locales.disconnect}
      </DisconnectButton>
    </PageContent>
  )
}

export default Profile

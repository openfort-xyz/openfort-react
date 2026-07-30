'use client'

import { AnimatePresence, type Variants } from 'framer-motion'
import React from 'react'
import { useEmailAuth } from '../../../hooks/openfort/auth/useEmailAuth.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { logger } from '../../../utils/logger.js'
import Button from '../../Common/Button/index.js'
import Input from '../../Common/Input/index.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import { TextContainer } from '../../ConnectButton/styles.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'

// TODO: Localize

const textVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 1, 0.5, 1],
    },
  },
  exit: {
    position: 'absolute',
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 1, 0.5, 1],
    },
  },
}

const LinkEmail: React.FC = () => {
  const { setRoute, triggerResize, emailInput: email, setEmailInput: setEmail } = useOpenfort()
  const { client } = useOpenfortCore()

  const [loginLoading, setLoginLoading] = React.useState(false)
  const [loginError, setLoginError] = React.useState<false | string>(false)
  const { linkEmail } = useEmailAuth()

  const handleSubmit = async () => {
    setLoginLoading(true)

    await client.validateAndRefreshToken()
    try {
      await linkEmail({ email })

      setRoute(routes.EMAIL_VERIFICATION)
    } catch (e) {
      logger.log('Link error:', e)
      setLoginError('Could not link email. Please try again.')
      setLoginLoading(false)
      triggerResize()
    }
  }

  return (
    <PageContent>
      <ModalHeading>Link your email</ModalHeading>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <Input
          style={{ marginTop: 0 }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Enter your email"
          disabled={loginLoading}
        />
        {loginError && (
          <ModalBody style={{ height: 24, marginTop: 12 }} $error>
            {loginError}
          </ModalBody>
        )}

        <Button onClick={handleSubmit} disabled={loginLoading} waiting={loginLoading}>
          <AnimatePresence initial={false}>
            {loginLoading ? (
              <TextContainer
                key="connectedText"
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={textVariants}
              >
                Linking email...
              </TextContainer>
            ) : (
              <TextContainer
                key="connectedText"
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={textVariants}
              >
                Link email
              </TextContainer>
            )}
          </AnimatePresence>
        </Button>
      </form>
    </PageContent>
  )
}

export default LinkEmail

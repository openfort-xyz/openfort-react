'use client'

import { EmailIcon, PhoneIcon } from '../../../assets/icons.js'
import Button from '../../Common/Button/index.js'
import Loader from '../../Common/Loading/index.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import { OtpInputStandalone } from '../../Common/OTPInput/index.js'
import { FloatingGraphic } from '../../FloatingGraphic/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent, type SetOnBackFunction } from '../../PageContent/index.js'
import { Body, FooterButtonText, FooterTextButton, ResultContainer } from '../EmailOTP/styles.js'
import type { AutomaticRecovery } from './useAutomaticRecovery.js'

/**
 * Collects the one-time code that unlocks the recovery share. Accounts without a
 * real email or phone cannot be sent a code at all, so they are pointed at the
 * providers page to link one first.
 */
const AutomaticRecoveryOtpPage = ({
  recovery,
  onBack,
  logoutOnBack,
}: {
  recovery: AutomaticRecovery
  onBack: SetOnBackFunction
  logoutOnBack: boolean
}) => {
  const { setRoute } = useOpenfort()
  const { otpResponse, otpStatus, otpError, submitOtp, resend } = recovery

  if ((!otpResponse?.email && !otpResponse?.phone) || otpResponse.email?.includes('@openfort.anonymous')) {
    return (
      <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
        <Loader
          isError={true}
          description={'You cannot create a wallet without authentication, please link email or phone to continue.'}
          header={'Cannot create wallet.'}
        />
        <Button onClick={() => setRoute(routes.PROVIDERS)}>Add an authentication method</Button>
      </PageContent>
    )
  }

  return (
    <PageContent onBack={onBack} logoutOnBack={logoutOnBack}>
      <ModalHeading>Enter your code</ModalHeading>

      <FloatingGraphic
        height="100px"
        marginTop="8px"
        marginBottom="10px"
        logoCenter={{
          logo: otpResponse.sentTo === 'phone' ? <PhoneIcon /> : <EmailIcon />,
        }}
      />
      <ModalBody>
        <Body>
          Please check <b>{otpResponse.sentTo === 'phone' ? otpResponse.phone : otpResponse.email}</b> and enter your
          code below.
        </Body>
        <OtpInputStandalone
          length={9}
          scale="80%"
          onComplete={submitOtp}
          isLoading={otpStatus === 'loading'}
          isError={otpStatus === 'error'}
          isSuccess={otpStatus === 'success'}
        />
        <ResultContainer>
          {otpStatus === 'success' && <ModalBody $valid>Code verified successfully!</ModalBody>}
          {otpStatus === 'error' && <ModalBody $error>{otpError || 'Invalid code. Please try again.'}</ModalBody>}
        </ResultContainer>
        <FooterTextButton>
          Didn't receive the code?{' '}
          <FooterButtonText type="button" onClick={resend.onClick} disabled={resend.disabled}>
            {resend.label}
          </FooterButtonText>
        </FooterTextButton>
      </ModalBody>
    </PageContent>
  )
}

export default AutomaticRecoveryOtpPage

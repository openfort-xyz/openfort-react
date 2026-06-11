'use client'

import { useFunding } from '../../../hooks/openfort/useFunding'
import useIsMobile from '../../../hooks/useIsMobile'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { type DepositMethodTarget, getPaymentOptions } from './paymentOptions'
import { DepositContent, OptionButton, OptionInfo, OptionList, OptionSubtitle, OptionTitle } from './styles'

/**
 * Deposit hub — one entry point, a method selector. Crypto/CEX route into the
 * new funding-session Pages; fiat rows reuse the existing Buy flow.
 */
const Deposit = () => {
  const { setRoute, setBuyForm } = useOpenfort()
  const isMobile = useIsMobile()
  const { isAvailable } = useFunding()

  const options = getPaymentOptions({ isMobile, fundingAvailable: isAvailable })

  const go = (target: DepositMethodTarget) => {
    if (target.kind === 'crypto') {
      setRoute(routes.DEPOSIT_CRYPTO)
      return
    }
    if (target.kind === 'cex') {
      setRoute(routes.DEPOSIT_CEX)
      return
    }
    // Fiat rails reuse the existing Buy flow; preselect the chosen provider so
    // Apple Pay / Card land on the right rail.
    setBuyForm((prev) => ({ ...prev, providerId: target.providerId }))
    setRoute(routes.BUY)
  }

  return (
    <PageContent onBack={routes.CONNECTED}>
      <ModalHeading>Add funds</ModalHeading>
      <ModalBody>Choose how you'd like to deposit.</ModalBody>
      <DepositContent>
        <OptionList>
          {options.map((option) => (
            <OptionButton key={option.id} type="button" disabled={option.disabled} onClick={() => go(option.target)}>
              <OptionInfo>
                <OptionTitle>{option.title}</OptionTitle>
                <OptionSubtitle>{option.disabledReason ?? option.subtitle}</OptionSubtitle>
              </OptionInfo>
            </OptionButton>
          ))}
        </OptionList>
      </DepositContent>
    </PageContent>
  )
}

export default Deposit

'use client'

import type React from 'react'
import Logos from '../../../assets/logos.js'
import wave from '../../../assets/wave.js'
import useLocales from '../../../hooks/useLocales.js'
import Button from '../../Common/Button/index.js'
import { ModalBody, ModalContent, ModalH1 } from '../../Common/Modal/styles.js'
import {
  FloatWrapper,
  Graphic,
  GraphicBackground,
  Logo,
  LogoGraphic,
  LogoGroup,
  LogoInner,
  LogoPosition,
  RotateWrapper,
} from '../../FloatingGraphic/styles.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'

const Introduction: React.FC = () => {
  const context = useOpenfort()
  const locales = useLocales({})

  const ctaUrl = context.uiConfig.walletOnboardingUrl ?? locales.onboardingScreen_ctaUrl
  return (
    <PageContent>
      <Graphic>
        <LogoGroup>
          <Logo>
            <LogoPosition>
              <LogoInner>
                <FloatWrapper>
                  <RotateWrapper>
                    <LogoGraphic>
                      <Logos.Coinbase background />
                    </LogoGraphic>
                  </RotateWrapper>
                </FloatWrapper>
              </LogoInner>
            </LogoPosition>
          </Logo>
          <Logo>
            <LogoPosition>
              <LogoInner>
                <FloatWrapper>
                  <RotateWrapper>
                    <LogoGraphic>
                      <Logos.MetaMask background />
                    </LogoGraphic>
                  </RotateWrapper>
                </FloatWrapper>
              </LogoInner>
            </LogoPosition>
          </Logo>
          <Logo>
            <LogoPosition>
              <LogoInner>
                <FloatWrapper>
                  <RotateWrapper>
                    <LogoGraphic>
                      <Logos.Trust />
                    </LogoGraphic>
                  </RotateWrapper>
                </FloatWrapper>
              </LogoInner>
            </LogoPosition>
          </Logo>
          <Logo>
            <LogoPosition>
              <LogoInner>
                <FloatWrapper>
                  <RotateWrapper>
                    <LogoGraphic>
                      <Logos.Argent />
                    </LogoGraphic>
                  </RotateWrapper>
                </FloatWrapper>
              </LogoInner>
            </LogoPosition>
          </Logo>
          <Logo>
            <LogoPosition>
              <LogoInner>
                <FloatWrapper>
                  <RotateWrapper>
                    <LogoGraphic>
                      <Logos.ImToken />
                    </LogoGraphic>
                  </RotateWrapper>
                </FloatWrapper>
              </LogoInner>
            </LogoPosition>
          </Logo>
        </LogoGroup>
        <GraphicBackground>{wave}</GraphicBackground>
      </Graphic>
      <ModalContent style={{ paddingBottom: 18 }}>
        <ModalH1 $small>{locales.onboardingScreen_h1}</ModalH1>
        <ModalBody>{locales.onboardingScreen_p}</ModalBody>
      </ModalContent>
      <Button href={ctaUrl} arrow>
        {locales.onboardingScreen_ctaText}
      </Button>
    </PageContent>
  )
}

export default Introduction

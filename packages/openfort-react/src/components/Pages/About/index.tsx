'use client'

import { AnimatePresence, MotionConfig } from 'framer-motion'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import useLocales from '../../../hooks/useLocales.js'

import Button from '../../Common/Button/index.js'
import FitText from '../../Common/FitText/index.js'
import { OrDivider } from '../../Common/Modal/index.js'
import { ModalBody, ModalContent, ModalH1 } from '../../Common/Modal/styles.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { type Easing, SlideOne, SlideThree, SlideTwo } from './graphics.js'
import {
  Dot,
  Dots,
  ImageContainer,
  ImageContainerInner,
  MobileImageContainer,
  Slide,
  Slider,
  Slides,
} from './styles.js'

const About: React.FC = () => {
  const locales = useLocales()
  const context = useOpenfort()

  const ctaUrl = context.uiConfig.ethereumOnboardingUrl ?? locales.aboutScreen_ctaUrl

  const [, setReady] = useState(true)
  const [slider, setSlider] = useState(0)
  const scrollPos = useRef(0)

  const animationEase: Easing = [0.16, 1, 0.3, 1]
  const animationDuration = 600

  const isSwipe = () => {
    if (sliderRef.current) {
      const { overflow } = getComputedStyle(sliderRef.current)
      return overflow !== 'visible'
    }
    return false
  }

  const gotoSlide = (index: number) => {
    setReady(false)
    if (isSwipe()) {
      scrollToSlide(index)
    } else {
      setSlider(index)
    }
  }

  const scrollToSlide = (index: number) => {
    if (sliderRef.current) {
      const { offsetWidth: width } = sliderRef.current
      sliderRef.current.scrollLeft = width * index
      setTimeout(() => setSlider(index), 100)
    }
  }

  // This event should not fire on mobile
  const onScroll = () => {
    if (!sliderRef.current) return

    const { offsetWidth: width, scrollLeft: x } = sliderRef.current

    const prevScroll = scrollPos.current
    scrollPos.current = x

    // Limit when the slider should be set after swipe
    const threshold = 4
    if (prevScroll - x > -threshold && prevScroll - x < threshold) {
      const currentSlide = Math.round(x / width)
      setSlider(currentSlide)
    }
  }
  const onTouchEnd = () => {
    if (!sliderRef.current) return
    const { offsetWidth: width, scrollLeft: x } = sliderRef.current
    const currentSlide = Math.round(x / width)
    setSlider(currentSlide)
  }

  const sliderRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!sliderRef.current) return
    sliderRef.current.addEventListener('scroll', onScroll)
    sliderRef.current.addEventListener('touchend', onTouchEnd)
    return () => {
      if (!sliderRef.current) return
      sliderRef.current.removeEventListener('scroll', onScroll)
      sliderRef.current.removeEventListener('touchend', onTouchEnd)
    }
  }, [sliderRef])

  const graphics: React.ReactNode[] = [
    <SlideOne key="slide-one" layoutId={'graphicCircle'} duration={animationDuration} ease={animationEase} />,
    <SlideTwo key="slide-two" layoutId={'graphicCircle'} duration={animationDuration} ease={animationEase} />,
    <SlideThree key="slide-three" layoutId={'graphicCircle'} duration={animationDuration} ease={animationEase} />,
  ]

  const mobileGraphics: React.ReactNode[] = [
    <SlideOne key="mobile-slide-one" duration={animationDuration} ease={animationEase} />,
    <SlideTwo key="mobile-slide-two" duration={animationDuration} ease={animationEase} />,
    <SlideThree key="mobile-slide-three" duration={animationDuration} ease={animationEase} />,
  ]

  // Adjust height of ModalBody to fit content based on language
  const slideHeight = (() => {
    switch (context.uiConfig.language) {
      case 'en-US':
      case 'zh-CN':
        return 64
      default:
        return 84
    }
  })()

  const slides: { key: string; content: React.ReactNode }[] = [
    {
      key: 'slide-a',
      content: (
        <>
          <ModalH1 style={{ height: 24 }} $small>
            <FitText>{locales.aboutScreen_a_h1}</FitText>
          </ModalH1>
          <ModalBody style={{ height: slideHeight }}>
            <FitText>{locales.aboutScreen_a_p}</FitText>
          </ModalBody>
        </>
      ),
    },
    {
      key: 'slide-b',
      content: (
        <>
          <ModalH1 style={{ height: 24 }} $small>
            <FitText>{locales.aboutScreen_b_h1}</FitText>
          </ModalH1>
          <ModalBody style={{ height: slideHeight }}>
            <FitText>{locales.aboutScreen_b_p}</FitText>
          </ModalBody>
        </>
      ),
    },
    {
      key: 'slide-c',
      content: (
        <>
          <ModalH1 style={{ height: 24 }} $small>
            <FitText>{locales.aboutScreen_c_h1}</FitText>
          </ModalH1>
          <ModalBody style={{ height: slideHeight }}>
            <FitText>{locales.aboutScreen_c_p}</FitText>
          </ModalBody>
        </>
      ),
    },
  ]

  return (
    <PageContent>
      <Slider>
        <ImageContainer>
          <MotionConfig
            transition={{
              duration: animationDuration / 1000,
              ease: animationEase,
            }}
          >
            <AnimatePresence initial={false} onExitComplete={() => setReady(true)}>
              {slider === 0 && (
                <ImageContainerInner key="graphic-0" style={{ position: 'absolute' }}>
                  {graphics[0]}
                </ImageContainerInner>
              )}
              {slider === 1 && (
                <ImageContainerInner key="graphic-1" style={{ position: 'absolute' }}>
                  {graphics[1]}
                </ImageContainerInner>
              )}
              {slider === 2 && (
                <ImageContainerInner key="graphic-2" style={{ position: 'absolute' }}>
                  {graphics[2]}
                </ImageContainerInner>
              )}
            </AnimatePresence>
          </MotionConfig>
        </ImageContainer>
        <Slides ref={sliderRef}>
          <AnimatePresence>
            {slides.map((s, i) => (
              <Slide key={s.key} $active={slider === i}>
                <MobileImageContainer>
                  <MotionConfig
                    transition={{
                      duration: 0,
                    }}
                  >
                    <ImageContainerInner>{mobileGraphics[i]}</ImageContainerInner>
                  </MotionConfig>
                </MobileImageContainer>
                <ModalContent style={{ gap: 8, paddingBottom: 0 }}>{s.content}</ModalContent>
              </Slide>
            ))}
          </AnimatePresence>
        </Slides>
      </Slider>
      <OrDivider>
        <Dots>
          {slides.map((s, i) => (
            <Dot key={s.key} $active={slider === i} onClick={() => gotoSlide(i)} />
          ))}
        </Dots>
      </OrDivider>
      <Button href={ctaUrl} arrow>
        {locales.aboutScreen_ctaText}
      </Button>
    </PageContent>
  )
}

export default About

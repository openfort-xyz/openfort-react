'use client'

import React, { useEffect } from 'react'
import { useEmailAuth } from '../../../hooks/openfort/auth/useEmailAuth.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { logger } from '../../../utils/logger.js'
import { parseCallbackUrl } from '../../../utils/urlSecurity.js'
import Button from '../../Common/Button/index.js'
import FitText from '../../Common/FitText/index.js'
import Input from '../../Common/Input/index.js'
import { ModalBody } from '../../Common/Modal/styles.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'

// TODO: Localize
const RequestEmail: React.FC = () => {
  const { triggerResize, emailInput: email, setEmailInput: setEmail, setRoute } = useOpenfort()
  const client = useOpenfortCore((s) => s.client)

  const [loading, setLoading] = React.useState(false)
  const submittingRef = React.useRef(false)

  const [message, setMessage] = React.useState<string>('')
  const [error, setError] = React.useState<string>('')

  // biome-ignore lint/correctness/useExhaustiveDependencies: the presence of an error is the trigger — the error banner adds a row to the form
  useEffect(() => {
    triggerResize()
  }, [!error, triggerResize])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('')
      }, 5000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [message])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('')
      }, 5000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [error])

  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true

    const cleanURL = window.location.origin + window.location.pathname
    setLoading(true)
    try {
      await client.auth.requestResetPassword({
        email,
        redirectUrl: `${cleanURL}?openfortForgotPasswordUI=true&email=${email}`,
      })
      setMessage('Reset email sent.')
      setTimeout(() => {
        setRoute(routes.EMAIL_LOGIN)
      }, 1000)
    } catch (e: unknown) {
      logger.log(e)
      const code = (e as { response?: { status?: number } })?.response?.status
      switch (code) {
        case 400:
          setError('Email not verified.')
          break
        default:
          setError('Error sending reset email.')
          break
      }
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <PageContent>
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
          disabled={loading}
        />
        {error && (
          <ModalBody style={{ marginTop: 12 }} $error>
            <FitText>{error}</FitText>
          </ModalBody>
        )}
        <Button type="submit" disabled={loading || !!message} waiting={loading}>
          {message ? message : 'Send reset email'}
        </Button>
      </form>
    </PageContent>
  )
}

type ResetRequest = {
  email: string | null
  state: string | null
  sanitizedUrl: string
}

const ResetPassword: React.FC<{ resetRequest: ResetRequest }> = ({ resetRequest }) => {
  const { email, state, sanitizedUrl } = resetRequest

  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string>('')
  const [message, setMessage] = React.useState<string>('')
  const submittingRef = React.useRef(false)

  const { setRoute, setEmailInput, triggerResize } = useOpenfort()
  const { resetPassword, signInEmail, isLoading } = useEmailAuth({
    recoverWalletAutomatically: false,
  })

  React.useLayoutEffect(() => {
    const existingReferrerMeta = document.head.querySelector<HTMLMetaElement>('meta[name="referrer"]')
    const referrerMeta = existingReferrerMeta ?? document.createElement('meta')
    const previousPolicy = existingReferrerMeta?.getAttribute('content') ?? null

    if (!existingReferrerMeta) {
      referrerMeta.name = 'referrer'
      document.head.appendChild(referrerMeta)
    }
    referrerMeta.content = 'no-referrer'
    window.history.replaceState(window.history.state, document.title, sanitizedUrl)

    return () => {
      if (!existingReferrerMeta) {
        referrerMeta.remove()
      } else if (previousPolicy === null) {
        referrerMeta.removeAttribute('content')
      } else {
        referrerMeta.content = previousPolicy
      }
    }
  }, [sanitizedUrl])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `error` and `message` are re-measure triggers — each banner adds a row to the form
  useEffect(() => {
    triggerResize()
  }, [error, message, triggerResize])

  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setError('')

    if (!email || !state) {
      setError('This reset link is invalid or has expired. Request a new one.')
      submittingRef.current = false
      return
    }

    try {
      const { error: resetError } = await resetPassword({ email, password, state })
      if (resetError) {
        logger.error('Reset password failed')
        setError('Could not reset your password. Request a new reset email and try again.')
        return
      }

      const { error: signInError, requiresEmailVerification } = await signInEmail({ email, password })
      if (signInError || requiresEmailVerification) {
        logger.error('Sign in after password reset failed')
        setEmailInput(email)
        setMessage('Password updated. Sign in to continue.')
        setTimeout(() => {
          setRoute(routes.EMAIL_LOGIN)
        }, 1500)
        return
      }

      setRoute(routes.LOAD_WALLETS)
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <PageContent>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
      >
        <FitText>{email ? `Reset password for ${email}` : 'Reset password'}</FitText>
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Enter your new password"
          disabled={isLoading || !!message}
        />
        {error && (
          <ModalBody style={{ marginTop: 12 }} $error>
            <FitText>{error}</FitText>
          </ModalBody>
        )}
        <Button type="submit" disabled={isLoading || !!message} waiting={isLoading}>
          {message ? message : 'Reset password'}
        </Button>
      </form>
    </PageContent>
  )
}

const ForgotPassword: React.FC = () => {
  const [resetRequest] = React.useState<ResetRequest | null>(() => {
    const url = parseCallbackUrl(window.location.href)
    if (!url.searchParams.get('openfortForgotPasswordUI')) return null

    const request = {
      email: url.searchParams.get('email'),
      state: url.searchParams.get('state'),
    }
    for (const param of ['openfortForgotPasswordUI', 'state', 'email']) {
      url.searchParams.delete(param)
    }

    return { ...request, sanitizedUrl: url.toString() }
  })

  if (!resetRequest) return <RequestEmail />
  return <ResetPassword resetRequest={resetRequest} />
}

export default ForgotPassword

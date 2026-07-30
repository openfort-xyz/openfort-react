'use client'

import React, { useEffect } from 'react'
import { useEmailAuth } from '../../../hooks/openfort/auth/useEmailAuth'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { logger } from '../../../utils/logger'
import Button from '../../Common/Button'
import FitText from '../../Common/FitText'
import Input from '../../Common/Input'
import { ModalBody } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'

// TODO: Localize
const RequestEmail: React.FC = () => {
  const { triggerResize, emailInput: email, setEmailInput: setEmail, setRoute } = useOpenfort()
  const { client } = useOpenfortCore()

  const [loading, setLoading] = React.useState(false)

  const [message, setMessage] = React.useState<string>('')
  const [error, setError] = React.useState<string>('')

  useEffect(() => {
    triggerResize()
  }, [!error])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('')
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [message])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('')
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [error])

  const handleSubmit = async () => {
    const cleanURL = window.location.origin + window.location.pathname
    setLoading(true)
    client.auth
      .requestResetPassword({
        email,
        redirectUrl: `${cleanURL}?openfortForgotPasswordUI=true&email=${email}`,
      })
      .then(() => {
        setMessage('Reset email sent.')
        setTimeout(() => {
          setRoute(routes.EMAIL_LOGIN)
        }, 1000)
        setLoading(false)
      })
      .catch((e) => {
        logger.log(e)
        const code = e?.response?.status
        switch (code) {
          case 400:
            setError('Email not verified.')
            break
          default:
            setError('Error sending reset email.')
            break
        }

        setLoading(false)
      })
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
        <Button onClick={handleSubmit} disabled={loading || !!message} waiting={loading}>
          {message ? message : 'Send reset email'}
        </Button>
      </form>
    </PageContent>
  )
}

const ResetPassword: React.FC = () => {
  // The reset link carries `state` as the first query parameter, so it arrives as `?state=`
  // appended after the existing query string. Turn it into a regular parameter before parsing.
  const fixedUrl = window.location.href.replace('?state=', '&state=')
  const url = new URL(fixedUrl)

  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string>('')
  const [message, setMessage] = React.useState<string>('')

  const { setRoute, setEmailInput, triggerResize } = useOpenfort()
  const { resetPassword, signInEmail, isLoading } = useEmailAuth({
    recoverWalletAutomatically: false,
  })

  const email = url.searchParams.get('email')
  const state = url.searchParams.get('state')

  useEffect(() => {
    triggerResize()
  }, [error, message])

  const clearResetParams = () => {
    for (const param of ['openfortForgotPasswordUI', 'state', 'email']) {
      url.searchParams.delete(param)
    }
    window.history.replaceState({}, document.title, url.toString())
  }

  const handleSubmit = async () => {
    setError('')

    if (!email || !state) {
      setError('This reset link is invalid or has expired. Request a new one.')
      return
    }

    const { error: resetError } = await resetPassword({ email, password, state })
    if (resetError) {
      logger.error('Reset password failed', resetError.message)
      setError('Could not reset your password. Request a new reset email and try again.')
      return
    }

    clearResetParams()

    const { error: signInError, requiresEmailVerification } = await signInEmail({ email, password })
    if (signInError || requiresEmailVerification) {
      logger.error('Sign in after password reset failed', signInError?.message)
      setEmailInput(email)
      setMessage('Password updated. Sign in to continue.')
      setTimeout(() => {
        setRoute(routes.EMAIL_LOGIN)
      }, 1500)
      return
    }

    setRoute(routes.LOAD_WALLETS)
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
        <Button onClick={handleSubmit} disabled={isLoading || !!message} waiting={isLoading}>
          {message ? message : 'Reset password'}
        </Button>
      </form>
    </PageContent>
  )
}

const ForgotPassword: React.FC = () => {
  const url = new URL(window.location.href)
  const isRequestingEmail = !url.searchParams.get('openfortForgotPasswordUI')

  if (isRequestingEmail) return <RequestEmail />
  else return <ResetPassword />
}

export default ForgotPassword

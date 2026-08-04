'use client'

import { useEffect, useRef, useState } from 'react'
import { providersLogos } from '../../assets/logos.js'
import { ConnectorTypeMismatchError } from '../../errors/connection.js'
import { useAuthTransitions } from '../../openfort/authTransitionContext.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import { logger } from '../../utils/logger.js'
import { parseCallbackUrl, suppressReferrer } from '../../utils/urlSecurity.js'
import Loader from '../Common/Loading/index.js'
import { routes } from '../Openfort/types.js'
import { useOpenfort } from '../Openfort/useOpenfort.js'
import { PageContent } from '../PageContent/index.js'

const states = {
  INIT: 'init',
  REDIRECT: 'redirect',
  CONNECTING: 'connecting',
  CANCELLED: 'cancelled',
  ERROR: 'error',
}

const ConnectWithOAuth: React.FC = () => {
  const { connector, setRoute, triggerResize } = useOpenfort()
  const client = useOpenfortCore((s) => s.client)
  const { captureAuthSession, startAuthenticatedMutation, startAuthTransition } = useAuthTransitions()
  const updateUser = useOpenfortCore((s) => s.updateUser)
  const user = useOpenfortCore((s) => s.user)

  const [status, setStatus] = useState(states.INIT)
  const [description, setDescription] = useState<string | undefined>(undefined)

  // The effect below is a state machine driven solely by `status`: each transition consumes the
  // OAuth query parameters and then strips them from the URL, so it must run once per state. It
  // reads its other inputs from this ref, which holds the values as of the transition — depending
  // on them would replay a transition whose parameters are already gone. `user`, in particular,
  // lands in the store moments after the credentials are stored.
  const latestRef = useRef({
    connector,
    user,
    client,
    captureAuthSession,
    startAuthenticatedMutation,
    startAuthTransition,
    updateUser,
    setRoute,
    triggerResize,
  })
  useEffect(() => {
    latestRef.current = {
      connector,
      user,
      client,
      captureAuthSession,
      startAuthenticatedMutation,
      startAuthTransition,
      updateUser,
      setRoute,
      triggerResize,
    }
  })

  useEffect(() => {
    const {
      connector,
      user,
      client,
      captureAuthSession,
      startAuthenticatedMutation,
      startAuthTransition,
      updateUser,
      setRoute,
      triggerResize,
    } = latestRef.current
    ;(async () => {
      const win = typeof window !== 'undefined' ? window : null
      const doc = typeof document !== 'undefined' ? document : null
      if (!win || !doc) return
      if (connector.type !== 'oauth')
        throw new ConnectorTypeMismatchError({ expected: 'oauth', received: connector.type })

      const url = parseCallbackUrl(win.location.href)
      const hasProvider = !!url.searchParams.get('openfortAuthProviderUI')
      const provider = connector.id

      switch (status) {
        case states.INIT:
          if (hasProvider) setStatus(states.CONNECTING)
          else setTimeout(() => setStatus(states.REDIRECT), 150) // UX: wait a bit before redirecting
          break
        case states.CONNECTING: {
          // Suppress Referer before any async work to prevent token leakage
          const restoreReferrer = suppressReferrer()

          const userId = url.searchParams.get('user_id')
          const token = url.searchParams.get('access_token')
          const error = url.searchParams.get('error')

          // Remove specified keys from the URL
          ;['openfortAuthProviderUI', 'access_token', 'user_id', 'error'].forEach((key) => {
            url.searchParams.delete(key)
          })
          win.history.replaceState({}, doc.title, url.toString())
          restoreReferrer()

          if (!userId || !token || error) {
            logger.error('Missing user id or access token', {
              hasUserId: !!userId,
              hasToken: !!token,
            })
            setStatus(states.ERROR)
            if (error) {
              switch (error) {
                case "email_doesn't_match":
                  setDescription('The email associated with this OAuth provider does not match your account email.')
                  break
                default:
                  setDescription('There was an error during authentication. Please try again.')
              }
            } else {
              setDescription('There was an error during authentication. Please try again.')
            }
            triggerResize()
            return
          }

          const transition = startAuthTransition(() => client.auth.storeCredentials({ token, userId }))
          const settleStale = () => {
            if (transition.isCurrent()) return false
            setDescription('Authentication changed before this sign-in completed. Please try again.')
            setStatus(states.CANCELLED)
            triggerResize()
            return true
          }
          try {
            await transition.result
            if (settleStale()) return
            await updateUser()
            if (settleStale()) return
            setRoute(routes.LOADING)
          } catch (cause) {
            if (settleStale()) return
            logger.error('Error storing OAuth credentials:', cause)
            setDescription('There was an error during authentication. Please try again.')
            setStatus(states.ERROR)
            triggerResize()
          }
          break
        }
        case states.REDIRECT: {
          if (hasProvider) return

          const baseURL = win.location.origin + win.location.pathname
          const hash = win.location.hash

          const queryParams = Object.fromEntries(
            [...url.searchParams.entries()].filter(([key]) =>
              ['openfortAuthProviderUI', 'refresh_token', 'access_token', 'player_id'].includes(key)
            )
          )
          queryParams.openfortAuthProviderUI = provider

          // Query params must come before the hash fragment in a valid URL
          const redirectTo = `${baseURL}?${new URLSearchParams(queryParams).toString()}${hash}`

          let linkIsCurrent: (() => boolean) | undefined
          try {
            if (user) {
              const session = captureAuthSession()
              linkIsCurrent = session.isCurrent
              const authToken = await client.getAccessToken()
              if (!linkIsCurrent()) return
              if (!authToken) {
                logger.error('No auth token found')
                setRoute(routes.LOADING)
                return
              }
              const transition = startAuthenticatedMutation(() =>
                client.auth.initLinkOAuth({
                  provider,
                  redirectTo,
                })
              )
              linkIsCurrent = () => session.isCurrent() && transition.isCurrent()
              const linkResponse = await transition.result
              if (!linkIsCurrent()) return
              win.location.href = linkResponse
            } else {
              const r = await client.auth.initOAuth({
                provider,
                redirectTo,
              })
              win.location.href = r
            }
          } catch (e) {
            if (linkIsCurrent && !linkIsCurrent()) return
            logger.error('Error during OAuth initialization:', e)
            setStatus(states.ERROR)
            triggerResize()
            if (e instanceof Error) {
              if (e.message.includes('not enabled')) {
                setDescription(`The ${provider} provider is not enabled. Please contact support.`)
              } else {
                setDescription('There was an error during authentication. Please try again.')
              }
            }
          }
          break
        }
      }
    })()
  }, [status])

  return (
    <PageContent>
      <Loader
        header={`Connecting with ${connector.id}`}
        icon={providersLogos[connector.id]}
        isError={status === states.ERROR || status === states.CANCELLED}
        description={description}
        onRetry={() => {
          setStatus(states.INIT)
          setDescription(undefined)
        }}
      />
    </PageContent>
  )
}

export default ConnectWithOAuth

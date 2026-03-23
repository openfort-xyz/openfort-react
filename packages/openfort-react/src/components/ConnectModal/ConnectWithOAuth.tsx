'use client'

import { useEffect, useState } from 'react'
import { providersLogos } from '../../assets/logos'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import { logger } from '../../utils/logger'
import Loader from '../Common/Loading'
import { routes } from '../Openfort/types'
import { useOpenfort } from '../Openfort/useOpenfort'
import { PageContent } from '../PageContent'

const states = {
  INIT: 'init',
  REDIRECT: 'redirect',
  CONNECTING: 'connecting',
  ERROR: 'error',
}

const ConnectWithOAuth: React.FC = () => {
  const { connector, setRoute, triggerResize } = useOpenfort()
  const { client, user } = useOpenfortCore()

  const [status, setStatus] = useState(states.INIT)
  const [description, setDescription] = useState<string | undefined>(undefined)

  useEffect(() => {
    ;(async () => {
      const win = typeof window !== 'undefined' ? window : null
      const doc = typeof document !== 'undefined' ? document : null
      if (!win || !doc) return
      if (connector.type !== 'oauth') throw new Error('Invalid connector type')

      const url = new URL(win.location.href.replace('?access_token=', '&access_token=')) // handle both ? and & cases
      const hasProvider = !!url.searchParams.get('openfortAuthProviderUI')
      const provider = connector.id

      switch (status) {
        case states.INIT:
          if (hasProvider) setStatus(states.CONNECTING)
          else setTimeout(() => setStatus(states.REDIRECT), 150) // UX: wait a bit before redirecting
          break
        case states.CONNECTING: {
          const userId = url.searchParams.get('user_id')
          const token = url.searchParams.get('access_token')
          const error = url.searchParams.get('error')

          // Remove specified keys from the URL
          ;['openfortAuthProviderUI', 'access_token', 'user_id', 'error'].forEach((key) => {
            url.searchParams.delete(key)
          })
          win.history.replaceState({}, doc.title, url.toString())

          if (!userId || !token || error) {
            logger.error(
              `Missing user id or access token: userId=${userId}, accessToken=${token ? `${token.substring(0, 10)}...` : token}`
            )
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

          await client.auth.storeCredentials({
            token,
            userId,
          })

          setRoute(routes.LOADING)
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

          try {
            if (user) {
              const authToken = await client.getAccessToken()
              if (!authToken) {
                logger.error('No auth token found')
                setRoute(routes.LOADING)
                return
              }
              const linkResponse = await client.auth.initLinkOAuth({
                provider,
                redirectTo,
              })
              logger.log(linkResponse)
              win.location.href = linkResponse
            } else {
              const r = await client.auth.initOAuth({
                provider,
                redirectTo,
              })
              logger.log(r)
              win.location.href = r
            }
          } catch (e) {
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
        isError={status === states.ERROR}
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

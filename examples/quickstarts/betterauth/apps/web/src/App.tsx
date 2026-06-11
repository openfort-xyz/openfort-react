import { useSignOut, useUser } from '@openfort/react'
import { useCallback, useEffect, useRef } from 'react'
import { Main } from './components/cards/main'
import { useSession } from './integrations/betterauth'

function App() {
  const { getAccessToken } = useUser()
  const { signOut } = useSignOut()
  const { data: session, isPending } = useSession()
  const hasUser = Boolean(session?.user)
  const sessionToken = session?.session?.token
  const hadSessionRef = useRef(false)

  const getAccessTokenRef = useRef(getAccessToken)
  getAccessTokenRef.current = getAccessToken
  const signOutRef = useRef(signOut)
  signOutRef.current = signOut

  const syncSession = useCallback(() => {
    void getAccessTokenRef.current().catch((error) => {
      console.error(
        'Better Auth - Failed to sync session with Openfort:',
        error,
      )
    })
  }, [])

  useEffect(() => {
    if (isPending) {
      return
    }

    if (hasUser && sessionToken) {
      console.log('Better Auth - Session active, syncing with Openfort')
      hadSessionRef.current = true
      syncSession()
      return
    }

    if (hadSessionRef.current) {
      console.log('Better Auth - Session ended, clearing Openfort session')
      hadSessionRef.current = false
      void signOutRef.current()
    }
  }, [hasUser, isPending, sessionToken, syncSession])

  return (
    <div>
      <Main />
    </div>
  )
}

export default App

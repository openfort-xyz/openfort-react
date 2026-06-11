import { useOpenfort, useUser } from '@openfort/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen'
import { App } from '@/components/Showcase/app'
import { usePlaygroundMode } from '@/providers'

export const Route = createFileRoute('/_showcase/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isAuthenticated } = useUser()
  const { isLoading } = useOpenfort()
  const { isPostModeSwitch, clearPostModeSwitch } = usePlaygroundMode()
  const nav = useNavigate()

  useEffect(() => {
    if (!isLoading) {
      clearPostModeSwitch()
    }
  }, [isLoading, clearPostModeSwitch])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      nav({ to: '/showcase/auth', search: true })
    }
  }, [isAuthenticated, isLoading, nav])

  const showRestoringSession = isPostModeSwitch && isLoading
  if (showRestoringSession) {
    return <AuthLoadingScreen />
  }

  if (isAuthenticated) {
    return <App />
  }

  return null
}

import { useOpenfort, useUser } from '@openfort/react'
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen'
import { usePlaygroundMode } from '@/providers'

export const Route = createFileRoute('/_showcase/showcase/auth')({
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
    if (!isLoading && isAuthenticated) {
      nav({ to: '/' })
    }
  }, [isAuthenticated, isLoading, nav])

  const showRestoringSession = isPostModeSwitch && isLoading
  if (showRestoringSession) {
    return <AuthLoadingScreen />
  }

  return <Outlet />
}

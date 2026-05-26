import { ChainTypeEnum, type Theme, useOpenfort } from '@openfort/react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useLayoutEffect } from 'react'
import z from 'zod'
import { Analytics } from '@/components/Analytics'
import { AppSidebar } from '@/components/AppSidebar'
import { TopBar } from '@/components/TopBar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { initializeAnalytics } from '@/lib/analytics'
import { useAppStore } from '@/lib/useAppStore'
import { usePlaygroundMode } from '@/providers'

initializeAnalytics()

const MODE_TO_CHAIN: Record<'evm' | 'svm', ChainTypeEnum> = {
  evm: ChainTypeEnum.EVM,
  svm: ChainTypeEnum.SVM,
}

export const Route = createRootRoute({
  component: RootComponent,
  validateSearch: z.object({
    focus: z.string().optional(),
  }),
})

const themes: Theme[] = ['auto', 'midnight', 'nouns', 'retro', 'rounded', 'soft', 'web95', 'minimal']

let themeIndex = 0

function RootComponent() {
  const { mode } = usePlaygroundMode()
  const { chainType, setChainType } = useOpenfort()

  // Sync chainType from stored playground mode on load and when mode changes.
  useLayoutEffect(() => {
    const targetChain = MODE_TO_CHAIN[mode]
    if (chainType !== targetChain) {
      setChainType(targetChain)
    }
  }, [mode, chainType, setChainType])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && (e.target as HTMLElement).tagName !== 'INPUT') {
        const delta = e.key === 'ArrowRight' ? 1 : -1
        themeIndex = (themeIndex + delta + themes.length) % themes.length

        const { providerOptions, setProviderOptions } = useAppStore.getState()
        setProviderOptions({
          ...providerOptions,
          uiConfig: {
            ...providerOptions.uiConfig,
            theme: themes[themeIndex],
          },
        })
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [])

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar />
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
      <Analytics />
    </SidebarProvider>
  )
}

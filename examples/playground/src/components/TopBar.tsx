import { ChainTypeEnum, OpenfortButton, useOpenfort } from '@openfort/react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, SettingsIcon } from 'lucide-react'
import { useCallback } from 'react'
import { MODE_ICONS } from '@/assets/chain-icons'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useAutoConnectOnModeSwitch } from '@/hooks/useAutoConnectOnModeSwitch'
import type { OpenfortPlaygroundMode } from '@/providers'
import { useModeSwitchContext, usePlaygroundMode } from '@/providers'

const MODE_LABELS: Record<OpenfortPlaygroundMode, string> = {
  svm: 'Solana',
  evm: 'Ethereum',
}

const MODE_TO_CHAIN: Record<OpenfortPlaygroundMode, ChainTypeEnum> = {
  svm: ChainTypeEnum.SVM,
  evm: ChainTypeEnum.EVM,
}

export const TopBar = () => {
  const { mode, setMode, isPostModeSwitch } = usePlaygroundMode()
  const { setChainType, isLoading: isAuthLoading } = useOpenfort()
  const { onBeforeModeSwitch } = useModeSwitchContext()
  const restoring = isPostModeSwitch && isAuthLoading

  const handleModeSwitch = useCallback(
    (next: OpenfortPlaygroundMode) => {
      if (next === mode) return
      onBeforeModeSwitch?.()
      setChainType(MODE_TO_CHAIN[next])
      setMode(next)
    },
    [mode, onBeforeModeSwitch, setChainType, setMode]
  )

  useAutoConnectOnModeSwitch(mode)

  return (
    <header className="sticky top-0 z-10 flex h-(--nav-height) shrink-0 items-center gap-2 border-b bg-background-200 text-foreground px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-5" />

      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {MODE_ICONS[mode]}
              {MODE_LABELS[mode]}
              <ChevronDown className="size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['evm', 'svm'] as const).map((m) => (
              <DropdownMenuItem key={m} onClick={() => handleModeSwitch(m)} className="flex items-center gap-2">
                {MODE_ICONS[m]}
                {MODE_LABELS[m]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ModeToggle />

        <div
          className={restoring ? 'pointer-events-none opacity-60' : ''}
          title={restoring ? 'Restoring session…' : undefined}
        >
          <OpenfortButton />
        </div>

        <Button asChild variant="ghost" size="icon">
          <Link to="/provider" aria-label="Settings">
            <SettingsIcon className="size-4.5" />
          </Link>
        </Button>
      </div>
    </header>
  )
}

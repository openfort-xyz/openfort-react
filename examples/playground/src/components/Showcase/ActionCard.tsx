import type { ReactNode } from 'react'
import { useState } from 'react'
import { HookBadge } from '@/components/HookBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import type { FileRoutesByFullPath } from '@/routeTree.gen'

/** One way of performing an action: with your own UI, or with Openfort's widget. */
export type ActionVariant = {
  /** Hook or API the variant demonstrates, shown as a chip. */
  hook?: string
  /** Links the chip to that hook's inspector page. */
  href?: keyof FileRoutesByFullPath
  content: ReactNode
}

type ActionCardProps = {
  title: string
  description: string
  /** Your own UI calling SDK hooks directly. */
  headless?: ActionVariant
  /** Openfort's prebuilt modal — `useUI().open*`. */
  widget?: ActionVariant
}

const MODES = [
  { id: 'headless', label: 'Headless' },
  { id: 'widget', label: 'UI widget' },
] as const

type ModeId = (typeof MODES)[number]['id']

/**
 * A card per action rather than per hook, so the two ways of performing it sit
 * side by side: build the screen yourself against the hooks, or hand off to the
 * prebuilt modal. Cards offering only one of the two render without the toggle.
 */
export const ActionCard = ({ title, description, headless, widget }: ActionCardProps) => {
  const [mode, setMode] = useState<ModeId>(headless ? 'headless' : 'widget')
  const active = mode === 'headless' ? headless : widget
  const variant = active ?? headless ?? widget
  const bothAvailable = !!headless && !!widget

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {bothAvailable && (
            <div className="flex shrink-0 rounded-md bg-muted p-0.5" role="tablist">
              {MODES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  onClick={() => setMode(id)}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-medium transition-colors',
                    mode === id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {variant?.hook && <HookBadge hook={variant.hook} href={variant.href} className="mt-1" />}
      </CardHeader>
      <CardContent className="space-y-2">{variant?.content}</CardContent>
    </Card>
  )
}

import { Link } from '@tanstack/react-router'
import { Code2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { FileRoutesByFullPath } from '@/routeTree.gen'

type HookBadgeProps = {
  /** Hook name, e.g. "useSignMessage". */
  hook: string
  /** When set, the chip links to that hook's inspector page. */
  href?: keyof FileRoutesByFullPath
  /** Optional function/value to focus when navigating to the inspector. */
  fn?: string
  className?: string
}

const chipClass =
  'inline-flex w-fit items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground'

/** Always-visible chip showing the hook a feature demonstrates. Links to its inspector when `href` is set. Replaces hover-only tooltips. */
export const HookBadge = ({ href, hook, fn, className }: HookBadgeProps) => {
  const label = (
    <>
      <Code2 className="size-3 shrink-0" />
      <span className="truncate">
        {hook}
        {fn ? `.${fn}` : ''}
      </span>
    </>
  )

  if (!href) {
    return <span className={cn(chipClass, className)}>{label}</span>
  }

  return (
    <Link
      to={href}
      search={fn ? { focus: fn } : undefined}
      className={cn(chipClass, 'transition-colors hover:bg-accent hover:text-foreground', className)}
    >
      {label}
    </Link>
  )
}

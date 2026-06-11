import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight, LayoutDashboard } from 'lucide-react'
import { AccountPanel } from '@/components/AccountPanel'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Logo } from '@/components/ui/logo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { type NavRoute, navRoutes } from '@/lib/navRoute'
import { usePlaygroundMode } from '@/providers'

export const AppSidebar = () => {
  const location = useLocation()
  const { mode } = usePlaygroundMode()
  const path = location.pathname.includes('showcase') ? '/' : location.pathname

  const isActive = (item: NavRoute): boolean => {
    if (item.exact) return path === item.href
    return (!!item.href && path.includes(item.href)) || (item.children?.some(isActive) ?? false)
  }

  const visibleInMode = (item: NavRoute) => !item.modes || item.modes.includes(mode)

  return (
    <Sidebar>
      <SidebarHeader>
        <Link to="/" className="flex items-center px-2 py-1.5 text-inherit">
          <Logo className="h-7" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={path === '/'}>
                <Link to="/">
                  <LayoutDashboard className="size-4" />
                  <span>Wallet actions</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {navRoutes.map((group) => {
          const children = (group.children ?? []).filter(visibleInMode)
          if (children.length === 0) return null
          return (
            <SidebarGroup key={group.label}>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <span>{group.label}</span>
                        <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {children.map((child) => (
                          <SidebarMenuSubItem key={child.href}>
                            <SidebarMenuSubButton asChild isActive={isActive(child)}>
                              <Link to={child.href!} className="font-mono text-xs">
                                {child.label}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </SidebarMenu>
              </Collapsible>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <AccountPanel />
      </SidebarFooter>
    </Sidebar>
  )
}

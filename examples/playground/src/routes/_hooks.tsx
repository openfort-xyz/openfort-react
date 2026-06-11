import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_hooks')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-(--max-screen-width) flex-1 overflow-hidden">
      <Outlet />
    </div>
  )
}

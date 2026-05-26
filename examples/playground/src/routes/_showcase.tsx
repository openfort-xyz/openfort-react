import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_showcase')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="mx-auto flex w-full max-w-(--max-screen-width) flex-1 flex-col">
      <Outlet />
    </div>
  )
}

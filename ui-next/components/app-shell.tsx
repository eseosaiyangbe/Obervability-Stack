"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"

function isPublicShellRoute(pathname: string | null) {
  if (!pathname) return false
  return pathname === "/" || pathname.startsWith("/auth")
}

export function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const hideSidebar = isPublicShellRoute(pathname)

  if (hideSidebar) {
    return (
      <main className="min-h-screen bg-background">
        {children}
      </main>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 min-w-0 main-content transition-all duration-300 ease-in-out">
        <div className="max-w-[1920px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

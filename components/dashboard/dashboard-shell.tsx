"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import {
  BriefcaseIcon,
  LayoutDashboardIcon,
  PlusCircleIcon,
  SettingsIcon,
} from "lucide-react"

import { useAuthSession } from "@/hooks/use-auth-session"
import { cn } from "@/lib/utils"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending, isError } = useAuthSession()

  useEffect(() => {
    if (isPending) return
    if (!session?.user) {
      router.replace("/login")
    }
  }, [isPending, session?.user, router])

  if (isPending || !session?.user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">
          {isError ? "Could not load session." : "Loading…"}
        </p>
      </div>
    )
  }

  const navLinkClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-secondary text-secondary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground no-underline"
          >
            <div className="leading-tight">
              <p className="font-heading text-base font-semibold">
                Job tracker
              </p>
              <p className="text-xs text-muted-foreground">
                Signed in as {session.user.email ?? "your account"}
              </p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className={navLinkClass(pathname === "/")}
              aria-current={pathname === "/" ? "page" : undefined}
            >
              <LayoutDashboardIcon className="size-4" aria-hidden />
              Dashboard
            </Link>
            <Link
              href="/new"
              className={navLinkClass(pathname === "/new")}
              aria-current={pathname === "/new" ? "page" : undefined}
            >
              <PlusCircleIcon className="size-4" aria-hidden />
              Track new job
            </Link>
            <Link
              href="/settings"
              className={navLinkClass(pathname === "/settings")}
              aria-current={pathname === "/settings" ? "page" : undefined}
            >
              <SettingsIcon className="size-4" aria-hidden />
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}

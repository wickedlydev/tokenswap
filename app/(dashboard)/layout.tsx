import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut, Zap } from 'lucide-react'
import { auth, signOut } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

function getInitials(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'TS'
  const parts = trimmed.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const userName = session.user.name ?? ''
  const userEmail = session.user.email ?? ''
  const initials = getInitials(userName || userEmail)

  async function handleSignOut() {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-border bg-card p-4 lg:flex">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 pb-6">
            <Zap className="h-5 w-5 text-violet-600" />
            <span className="text-sm font-semibold text-foreground">TokenSwap</span>
          </Link>
          <Sidebar />
          <div className="mt-auto border-t border-border pt-4">
            <div className="px-3 pb-2">
              <p className="truncate text-sm font-medium text-foreground">
                {userName || userEmail}
              </p>
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <form action={handleSignOut}>
              <Button variant="outline" className="w-full gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur lg:px-6">
            <MobileNav userName={userName} userEmail={userEmail} signOutAction={handleSignOut} />
            <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-foreground lg:hidden">
              <Zap className="h-5 w-5 text-violet-600" />
              TokenSwap
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-foreground">{userName || userEmail}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <ThemeToggle />
              <form action={handleSignOut}>
                <Button variant="outline" size="sm" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </form>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { Menu, Zap } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

type MobileNavProps = {
  userName?: string | null
  userEmail?: string | null
  signOutAction: () => Promise<void>
}

export function MobileNav({ userName, userEmail, signOutAction }: MobileNavProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="left-0 top-0 flex h-full w-72 max-w-[80vw] -translate-x-0 -translate-y-0 flex-col rounded-none p-4 sm:max-w-none"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-violet-600" />
          <Link href="/dashboard" className="text-sm font-semibold text-zinc-900">
            TokenSwap
          </Link>
        </div>
        <div className="mt-6">
          <Sidebar />
        </div>
        <div className="mt-auto border-t border-zinc-200 pt-4">
          <div className="px-2 pb-2">
            <p className="text-sm font-medium text-zinc-900 truncate">
              {userName || userEmail}
            </p>
            <p className="text-xs text-zinc-500 truncate">{userEmail}</p>
          </div>
          <form action={signOutAction}>
            <Button variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

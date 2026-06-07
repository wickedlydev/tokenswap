'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { ProviderBadge } from '@/components/shared/ProviderBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

type VaultItem = {
  id: string
  provider: string
  label: string
  isValid: boolean
  createdAt: string
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const diffMs = date.getTime() - Date.now()
  const diffSeconds = Math.round(diffMs / 1000)
  const diffMinutes = Math.round(diffSeconds / 60)
  const diffHours = Math.round(diffMinutes / 60)
  const diffDays = Math.round(diffHours / 24)
  const diffWeeks = Math.round(diffDays / 7)
  const diffMonths = Math.round(diffDays / 30)
  const diffYears = Math.round(diffDays / 365)

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(diffSeconds) < 60) return rtf.format(diffSeconds, 'second')
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute')
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day')
  if (Math.abs(diffWeeks) < 5) return rtf.format(diffWeeks, 'week')
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month')
  return rtf.format(diffYears, 'year')
}

export function VaultList({ vaults }: { vaults: VaultItem[] }) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/vault/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error || 'Failed to delete key', { duration: 5000 })
        return
      }
      toast.success('API key deleted', { duration: 3000 })
      router.refresh()
    } catch {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setDeletingId(null)
    }
  }

  if (vaults.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
        No API keys yet. Add your first key to start selling.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {vaults.map((vault) => (
        <div
          key={vault.id}
          className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
        >
          <div className="flex items-center gap-4">
            <ProviderBadge provider={vault.provider} />
            <div>
              <p className="text-sm font-medium text-foreground">{vault.label}</p>
              <p className="text-xs text-muted-foreground">Added {formatRelativeDate(vault.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              className={
                vault.isValid
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }
            >
              {vault.isValid ? 'Valid' : 'Invalid'}
            </Badge>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={deletingId === vault.id}>
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete API key</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. Make sure there are no active listings using this key.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(vault.id)}
                      disabled={deletingId === vault.id}
                    >
                      {deletingId === vault.id ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> Deleting
                        </span>
                      ) : (
                        'Delete'
                      )}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      ))}
    </div>
  )
}

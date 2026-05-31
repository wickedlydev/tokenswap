'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, MoreVertical } from 'lucide-react'
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
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type ListingItem = {
  id: string
  provider: string
  model: string
  tokensForSale: number
  tokensRemaining: number
  pricePerMillionTokens: number
  status: string
}

const statusClasses: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  depleted: 'bg-zinc-200 text-zinc-600',
  cancelled: 'bg-rose-100 text-rose-700',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function ListingsTable({ listings }: { listings: ListingItem[] }) {
  const router = useRouter()
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ListingItem | null>(null)
  const [price, setPrice] = useState(0)

  async function updateStatus(listing: ListingItem, nextStatus: 'active' | 'paused') {
    setWorkingId(listing.id)
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error || 'Failed to update listing', { duration: 5000 })
        return
      }
      toast.success(nextStatus === 'paused' ? 'Listing paused' : 'Listing activated', {
        duration: 3000,
      })
      router.refresh()
    } catch (error) {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setWorkingId(null)
    }
  }

  async function updatePrice() {
    if (!editing) return
    setWorkingId(editing.id)
    try {
      const res = await fetch(`/api/listings/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricePerMillionTokens: price }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error || 'Failed to update price', { duration: 5000 })
        return
      }
      toast.success('Price updated', { duration: 3000 })
      setEditing(null)
      router.refresh()
    } catch (error) {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setWorkingId(null)
    }
  }

  async function deleteListing(id: string) {
    const confirmed = window.confirm('Delete this listing? This cannot be undone.')
    if (!confirmed) return
    setWorkingId(id)
    try {
      const res = await fetch(`/api/listings/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error || 'Failed to delete listing', { duration: 5000 })
        return
      }
      toast.success('Listing deleted', { duration: 3000 })
      router.refresh()
    } catch (error) {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setWorkingId(null)
    }
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center text-sm text-zinc-500">
        No listings yet. Create your first listing to start earning.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Price / 1M</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.map((listing) => {
            const percent = listing.tokensForSale
              ? Math.round((listing.tokensRemaining / listing.tokensForSale) * 100)
              : 0
            const canToggle = ['active', 'paused'].includes(listing.status)
            return (
              <TableRow key={listing.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProviderBadge provider={listing.provider} />
                    <span className="text-sm font-medium text-zinc-900">{listing.model}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-xs text-zinc-500">
                      {listing.tokensRemaining.toLocaleString()} / {listing.tokensForSale.toLocaleString()}
                    </div>
                    <Progress value={Math.max(0, Math.min(100, percent))} className="h-2" />
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium text-zinc-900">
                  {formatCurrency(listing.pricePerMillionTokens)}
                </TableCell>
                <TableCell>
                  <Badge className={statusClasses[listing.status] || 'bg-zinc-100 text-zinc-600'}>
                    {listing.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={listing.status === 'active'}
                    disabled={!canToggle || workingId === listing.id}
                    onCheckedChange={(checked) =>
                      updateStatus(listing, checked ? 'active' : 'paused')
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditing(listing)
                          setPrice(listing.pricePerMillionTokens)
                        }}
                      >
                        Edit price
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-rose-600"
                        onClick={() => deleteListing(listing.id)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit price</DialogTitle>
            <DialogDescription>Update the price per 1M tokens for this listing.</DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            min={0.01}
            step={0.01}
            value={price}
            onChange={(event) => setPrice(Number(event.target.value))}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={updatePrice} disabled={workingId === editing?.id}>
              {workingId === editing?.id ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving
                </span>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { Key } from 'lucide-react'
import { toast } from 'sonner'
import { PurchaseCard } from '@/components/purchases/PurchaseCard'

type PurchaseItem = {
  id: string
  listingId?: string
  proxyKey: string | null
  tokensPurchased: number
  tokensRemaining: number
  totalPaidCents: number
  status: string
  createdAt: string
  listing: {
    provider: string
    model: string
  }
}

export function KeysClient({ purchases, showSuccess }: { purchases: PurchaseItem[]; showSuccess: boolean }) {
  useEffect(() => {
    if (showSuccess) {
      toast.success('Purchase successful! Your proxy key is ready.', { duration: 3000 })
    }
    return undefined
  }, [showSuccess])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">My Proxy Keys</h1>
        <p className="mt-1 text-zinc-500">View and manage your purchased proxy API keys</p>
      </div>

      {purchases.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <Key className="mx-auto h-12 w-12 text-zinc-300" />
          <h3 className="mt-4 text-lg font-semibold text-zinc-900">No proxy keys yet</h3>
          <p className="mt-2 text-sm text-zinc-500">Browse the marketplace to buy tokens.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {purchases.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))}
        </div>
      )}
    </div>
  )
}

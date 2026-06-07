import { Info } from 'lucide-react'
import { ListingGrid, ListingWithStats } from '@/components/listings/ListingGrid'

export default async function BuyPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const res = await fetch(`${appUrl}/api/listings`, { cache: 'no-store' })
  const json = (await res.json()) as { data?: ListingWithStats[] }
  const listings = res.ok && json.data ? json.data : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Buy API Credits</h1>
        <p className="mt-1 text-muted-foreground">
          Browse marketplace listings and save up to 50%+ vs retail
        </p>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Demo mode</strong> — payments use Stripe test cards (try{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
            4242 4242 4242 4242
          </code>
          ). No real money is charged.
        </p>
      </div>
      <ListingGrid listings={listings} />
    </div>
  )
}

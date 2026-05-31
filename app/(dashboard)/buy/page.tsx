import { ListingGrid, ListingWithStats } from '@/components/listings/ListingGrid'

export default async function BuyPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const res = await fetch(`${appUrl}/api/listings`, { cache: 'no-store' })
  const json = (await res.json()) as { data?: ListingWithStats[] }
  const listings = res.ok && json.data ? json.data : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Buy API Credits</h1>
        <p className="mt-1 text-zinc-500">
          Browse marketplace listings and save up to 50%+ vs retail
        </p>
      </div>
      <ListingGrid listings={listings} />
    </div>
  )
}

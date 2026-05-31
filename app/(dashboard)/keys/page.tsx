import { cookies } from 'next/headers'
import { KeysClient } from '@/components/purchases/KeysClient'

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

export default async function KeysPage({
  searchParams,
}: {
  searchParams?: { success?: string }
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const res = await fetch(`${appUrl}/api/purchases`, {
    cache: 'no-store',
    headers: { cookie: cookies().toString() },
  })
  const json = (await res.json()) as { data?: PurchaseItem[] }
  const purchases = res.ok && json.data ? json.data : []
  const showSuccess = searchParams?.success === 'true'

  return <KeysClient purchases={purchases} showSuccess={showSuccess} />
}

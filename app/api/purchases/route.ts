import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const purchases = await db.purchase.findMany({
      where: { buyerId: session.user.id },
      include: { listing: { select: { provider: true, model: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const data = purchases.map((purchase) => ({
      id: purchase.id,
      proxyKey: null,
      tokensPurchased: purchase.tokensPurchased,
      tokensRemaining: purchase.tokensRemaining,
      totalPaidCents: purchase.totalPaidCents,
      status: purchase.status,
      createdAt: purchase.createdAt.toISOString(),
      listing: purchase.listing,
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[PURCHASES_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

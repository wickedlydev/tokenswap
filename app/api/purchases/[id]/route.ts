import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const purchase = await db.purchase.findUnique({
      where: { id: params.id },
      include: { listing: { select: { provider: true, model: true } } },
    })

    if (!purchase || purchase.buyerId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        id: purchase.id,
        proxyKey: `ts-${purchase.proxyKey}`,
        tokensPurchased: purchase.tokensPurchased,
        tokensRemaining: purchase.tokensRemaining,
        totalPaidCents: purchase.totalPaidCents,
        status: purchase.status,
        createdAt: purchase.createdAt.toISOString(),
        listing: purchase.listing,
      },
    })
  } catch (error) {
    console.error('[PURCHASE_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

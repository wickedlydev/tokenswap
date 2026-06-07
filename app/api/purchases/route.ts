import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { toPurchaseListDTO } from '@/lib/serializers'

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

    return NextResponse.json({ data: purchases.map(toPurchaseListDTO) })
  } catch (error) {
    console.error('[PURCHASES_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

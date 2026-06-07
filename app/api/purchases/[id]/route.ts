import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { toPurchaseDetailDTO } from '@/lib/serializers'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const purchase = await db.purchase.findUnique({
      where: { id },
      include: { listing: { select: { provider: true, model: true } } },
    })

    if (!purchase || purchase.buyerId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data: toPurchaseDetailDTO(purchase) })
  } catch (error) {
    console.error('[PURCHASE_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

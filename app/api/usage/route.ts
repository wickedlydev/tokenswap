import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { toUsageLogDTO } from '@/lib/serializers'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const purchaseId = searchParams.get('purchaseId')

    if (!purchaseId) {
      return NextResponse.json({ error: 'purchaseId is required' }, { status: 400 })
    }

    const purchase = await db.purchase.findUnique({
      where: { id: purchaseId },
      select: { buyerId: true },
    })

    if (!purchase || purchase.buyerId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const logs = await db.usageLog.findMany({
      where: { purchaseId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ data: logs.map(toUsageLogDTO) })
  } catch (error) {
    console.error('[USAGE_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

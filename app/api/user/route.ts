import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = (await request.json()) as { name?: string }
    const trimmed = name?.trim()

    if (!trimmed) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data: { name: trimmed },
      select: { id: true, name: true, email: true },
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('[USER_PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { confirmEmail } = (await request.json()) as { confirmEmail?: string }
    if (!confirmEmail || confirmEmail !== session.user.email) {
      return NextResponse.json({ error: 'Email confirmation does not match' }, { status: 400 })
    }

    const [activeBuyerPurchases, ownActivePurchases] = await Promise.all([
      db.purchase.count({
        where: {
          status: { in: ['active', 'pending'] },
          listing: { sellerId: session.user.id },
        },
      }),
      db.purchase.count({
        where: { buyerId: session.user.id, status: 'active' },
      }),
    ])

    if (activeBuyerPurchases > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete account while buyers have active proxy keys against your listings. Pause your listings and wait for purchases to deplete or contact support.',
        },
        { status: 409 }
      )
    }

    if (ownActivePurchases > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete account while you have active proxy keys. Let them deplete or contact support.',
        },
        { status: 409 }
      )
    }

    await db.user.delete({ where: { id: session.user.id } })
    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('[USER_DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

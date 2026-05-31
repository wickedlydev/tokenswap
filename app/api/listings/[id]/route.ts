import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const listing = await db.listing.findUnique({
      where: { id },
      include: { seller: { select: { name: true } } },
    })

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        id: listing.id,
        provider: listing.provider,
        model: listing.model,
        tokensForSale: listing.tokensForSale,
        tokensRemaining: listing.tokensRemaining,
        pricePerMillionTokens: listing.pricePerMillionTokens,
        status: listing.status,
        createdAt: listing.createdAt.toISOString(),
        sellerName: listing.seller.name ?? 'Anonymous',
      },
    })
  } catch (error) {
    console.error('[LISTING_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = params
    const listing = await db.listing.findUnique({ where: { id } })

    if (!listing || listing.sellerId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      status?: string
      pricePerMillionTokens?: number
    }

    const updates: { status?: string; pricePerMillionTokens?: number } = {}

    if (typeof body.status === 'string') {
      if (!['active', 'paused'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updates.status = body.status
    }

    if (typeof body.pricePerMillionTokens === 'number') {
      if (body.pricePerMillionTokens <= 0) {
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
      }
      updates.pricePerMillionTokens = body.pricePerMillionTokens
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const updated = await db.listing.update({
      where: { id },
      data: updates,
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        provider: updated.provider,
        model: updated.model,
        tokensForSale: updated.tokensForSale,
        tokensRemaining: updated.tokensRemaining,
        pricePerMillionTokens: updated.pricePerMillionTokens,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        sellerName: null,
      },
    })
  } catch (error) {
    console.error('[LISTING_PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = params
    const listing = await db.listing.findUnique({ where: { id } })

    if (!listing || listing.sellerId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const activePurchases = await db.purchase.count({
      where: { listingId: id, status: 'active' },
    })

    if (activePurchases > 0) {
      return NextResponse.json(
        { error: 'Cannot delete listing with active purchases' },
        { status: 409 }
      )
    }

    const updated = await db.listing.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    return NextResponse.json({
      data: {
        id: updated.id,
        provider: updated.provider,
        model: updated.model,
        tokensForSale: updated.tokensForSale,
        tokensRemaining: updated.tokensRemaining,
        pricePerMillionTokens: updated.pricePerMillionTokens,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        sellerName: null,
      },
    })
  } catch (error) {
    console.error('[LISTING_DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

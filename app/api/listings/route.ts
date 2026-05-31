import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const provider = searchParams.get('provider')
  const model = searchParams.get('model')
  const minTokens = searchParams.get('minTokens')
  const sort = searchParams.get('sort') || 'price_asc'

  const where: {
    status: string
    provider?: string
    model?: string
    tokensRemaining?: { gte: number }
  } = { status: 'active' }

  if (provider) where.provider = provider
  if (model) where.model = model
  if (minTokens && !Number.isNaN(Number(minTokens))) {
    where.tokensRemaining = { gte: Number(minTokens) }
  }

  let orderBy: { pricePerMillionTokens?: 'asc' | 'desc'; createdAt?: 'desc'; tokensRemaining?: 'desc' } = {
    pricePerMillionTokens: 'asc',
  }
  if (sort === 'price_desc') orderBy = { pricePerMillionTokens: 'desc' }
  if (sort === 'newest') orderBy = { createdAt: 'desc' }
  if (sort === 'mostTokens') orderBy = { tokensRemaining: 'desc' }

  try {
    const listings = await db.listing.findMany({
      where,
      include: { seller: { select: { name: true } } },
      orderBy,
    })

    const data = listings.map((listing) => ({
      id: listing.id,
      provider: listing.provider,
      model: listing.model,
      tokensForSale: listing.tokensForSale,
      tokensRemaining: listing.tokensRemaining,
      pricePerMillionTokens: listing.pricePerMillionTokens,
      status: listing.status,
      createdAt: listing.createdAt.toISOString(),
      sellerName: listing.seller.name ?? 'Anonymous',
    }))

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[LISTINGS_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      vaultId?: string
      provider?: string
      model?: string
      tokensForSale?: number
      pricePerMillionTokens?: number
    }

    const tokensForSale = Number(body.tokensForSale)
    const pricePerMillionTokens = Number(body.pricePerMillionTokens)
    const { vaultId, provider, model } = body

    if (
      !vaultId ||
      !provider ||
      !model ||
      !Number.isFinite(tokensForSale) ||
      !Number.isFinite(pricePerMillionTokens) ||
      tokensForSale <= 0 ||
      pricePerMillionTokens <= 0
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const vault = await db.apiKeyVault.findUnique({ where: { id: vaultId } })
    if (!vault || vault.userId !== session.user.id) {
      return NextResponse.json({ error: 'Vault not found' }, { status: 404 })
    }

    const listing = await db.listing.create({
      data: {
        sellerId: session.user.id,
        vaultId,
        provider,
        model,
        tokensForSale,
        tokensRemaining: tokensForSale,
        pricePerMillionTokens,
      },
    })

    return NextResponse.json(
      {
        data: {
          id: listing.id,
          provider: listing.provider,
          model: listing.model,
          tokensForSale: listing.tokensForSale,
          tokensRemaining: listing.tokensRemaining,
          pricePerMillionTokens: listing.pricePerMillionTokens,
          status: listing.status,
          createdAt: listing.createdAt.toISOString(),
          sellerName: null,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[LISTINGS_POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

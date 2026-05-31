import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { listingId?: string; tokenAmount?: number }
    const listingId = body.listingId
    const tokenAmount = Number(body.tokenAmount)

    if (!listingId || !Number.isFinite(tokenAmount) || tokenAmount < 100_000) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const listing = await db.listing.findUnique({ where: { id: listingId } })

    if (!listing || listing.status !== 'active') {
      return NextResponse.json({ error: 'Listing not available' }, { status: 400 })
    }

    if (tokenAmount > listing.tokensRemaining) {
      return NextResponse.json({ error: 'Not enough tokens available' }, { status: 400 })
    }

    const subtotalDollars = (tokenAmount / 1_000_000) * listing.pricePerMillionTokens
    const platformFeeDollars = subtotalDollars * 0.1
    const totalDollars = subtotalDollars + platformFeeDollars
    const totalCents = Math.round(totalDollars * 100)
    const platformFeeCents = Math.round(platformFeeDollars * 100)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${listing.model} tokens`,
              description: `${tokenAmount.toLocaleString()} tokens via TokenSwap`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        listingId,
        buyerId: session.user.id,
        tokenAmount: String(tokenAmount),
        platformFeeCents: String(platformFeeCents),
      },
      success_url: `${appUrl}/keys?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/buy`,
    })

    return NextResponse.json({ data: { url: stripeSession.url } })
  } catch (error) {
    console.error('[CHECKOUT_POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')
  const body = await request.text()

  if (!sig) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (error) {
    console.error('[WEBHOOK_SIGNATURE]', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const stripeSession = event.data.object as Stripe.Checkout.Session
    const metadata = stripeSession.metadata || {}

    const listingId = metadata.listingId
    const buyerId = metadata.buyerId
    const tokenAmount = metadata.tokenAmount ? Number(metadata.tokenAmount) : 0
    const platformFeeCents = metadata.platformFeeCents
      ? Number(metadata.platformFeeCents)
      : 0

    if (!listingId || !buyerId || !tokenAmount) {
      console.error('[WEBHOOK_MISSING_METADATA]', { sessionId: stripeSession.id })
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    try {
      await db.$transaction(async (tx) => {
        const existing = await tx.purchase.findUnique({
          where: { stripeSessionId: stripeSession.id },
          select: { id: true },
        })
        if (existing) return

        const decrement = await tx.listing.updateMany({
          where: {
            id: listingId,
            status: 'active',
            tokensRemaining: { gte: tokenAmount },
          },
          data: { tokensRemaining: { decrement: tokenAmount } },
        })

        if (decrement.count === 0) {
          await tx.purchase.create({
            data: {
              buyerId,
              listingId,
              tokensPurchased: tokenAmount,
              tokensRemaining: 0,
              totalPaidCents: stripeSession.amount_total ?? 0,
              platformFeeCents,
              stripeSessionId: stripeSession.id,
              stripePaymentId:
                typeof stripeSession.payment_intent === 'string'
                  ? stripeSession.payment_intent
                  : null,
              status: 'pending_refund',
            },
          })
          console.error('[WEBHOOK_LISTING_UNAVAILABLE]', {
            listingId,
            tokenAmount,
            sessionId: stripeSession.id,
          })
          return
        }

        await tx.purchase.create({
          data: {
            buyerId,
            listingId,
            tokensPurchased: tokenAmount,
            tokensRemaining: tokenAmount,
            totalPaidCents: stripeSession.amount_total ?? 0,
            platformFeeCents,
            stripeSessionId: stripeSession.id,
            stripePaymentId:
              typeof stripeSession.payment_intent === 'string'
                ? stripeSession.payment_intent
                : null,
            status: 'active',
          },
        })

        const listingAfter = await tx.listing.findUnique({
          where: { id: listingId },
          select: { tokensRemaining: true },
        })
        if (listingAfter && listingAfter.tokensRemaining <= 0) {
          await tx.listing.update({
            where: { id: listingId },
            data: { status: 'depleted' },
          })
        }
      })
    } catch (error) {
      console.error('[WEBHOOK_PROCESS]', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  } else if (
    event.type === 'checkout.session.expired' ||
    event.type === 'payment_intent.payment_failed'
  ) {
    console.info('[WEBHOOK_UNHANDLED_NON_FATAL]', { type: event.type, id: event.id })
  } else {
    console.info('[WEBHOOK_UNHANDLED]', { type: event.type, id: event.id })
  }

  return NextResponse.json({ received: true })
}

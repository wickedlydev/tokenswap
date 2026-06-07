import Stripe from 'stripe'

const secret = process.env.STRIPE_SECRET_KEY
if (!secret || !secret.startsWith('sk_')) {
  throw new Error('STRIPE_SECRET_KEY must be set and start with sk_')
}

export const stripe = new Stripe(secret, {
  apiVersion: '2026-05-27.dahlia',
})

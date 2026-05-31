'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Loader2 } from 'lucide-react'
import { PROVIDERS } from '@/lib/providers'
import { ProviderBadge } from '@/components/shared/ProviderBadge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'

type ListingCardProps = {
  listing: {
    id: string
    provider: string
    model: string
    tokensForSale: number
    tokensRemaining: number
    pricePerMillionTokens: number
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function ListingCard({ listing }: ListingCardProps) {
  const [tokenAmount, setTokenAmount] = useState(100_000)
  const [submitting, setSubmitting] = useState(false)

  const retailPrice = useMemo(() => {
    const provider = PROVIDERS[listing.provider as keyof typeof PROVIDERS]
    const model = provider?.models.find((item) => item.id === listing.model)
    return model?.inputPricePer1M ?? 0
  }, [listing.model, listing.provider])

  const savingsPercent = useMemo(() => {
    if (!retailPrice) return 0
    return Math.max(0, Math.round((1 - listing.pricePerMillionTokens / retailPrice) * 100))
  }, [listing.pricePerMillionTokens, retailPrice])

  const maxTokens = listing.tokensRemaining
  const minTokens = 100_000
  const effectiveMin = Math.min(minTokens, maxTokens)
  const canBuy = maxTokens >= minTokens
  useEffect(() => {
    if (maxTokens <= 0) return
    setTokenAmount((current) => {
      const clamped = Math.min(Math.max(current, effectiveMin), maxTokens)
      return clamped
    })
  }, [effectiveMin, maxTokens])


  const subtotal = (tokenAmount / 1_000_000) * listing.pricePerMillionTokens
  const platformFee = subtotal * 0.1
  const total = subtotal + platformFee

  async function handleCheckout() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, tokenAmount }),
      })
      const data = (await res.json()) as { data?: { url?: string }; error?: string }

      if (res.ok && data.data?.url) {
        window.location.href = data.data.url
        return
      }

      toast.error(data.error || 'Failed to create checkout session', { duration: 5000 })
    } catch (error) {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900">{listing.model}</p>
          <ProviderBadge provider={listing.provider} />
        </div>

        <div className="mt-6 text-center">
          <p className="text-4xl font-bold text-zinc-900">
            {formatCurrency(listing.pricePerMillionTokens)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">/1M tokens</p>
          <p className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
            {savingsPercent}% cheaper than retail
          </p>
        </div>

        <div className="mt-6 space-y-2">
          <Progress
            value={Math.max(0, Math.min(100, (listing.tokensRemaining / listing.tokensForSale) * 100))}
            className="h-2"
          />
          <p className="text-xs text-zinc-500">
            {listing.tokensRemaining.toLocaleString()} of {listing.tokensForSale.toLocaleString()} tokens left
          </p>
        </div>

        <SheetTrigger asChild>
          <Button className="mt-6 w-full gap-2" disabled={!canBuy}>
            Buy Tokens <ArrowRight className="h-4 w-4" />
          </Button>
        </SheetTrigger>
      </div>

      <SheetContent side="right" className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle>Buy {listing.model} tokens</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Provider</span>
              <ProviderBadge provider={listing.provider} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
              <span>Price</span>
              <span className="font-medium text-zinc-900">
                {formatCurrency(listing.pricePerMillionTokens)} / 1M
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">Token amount</p>
              <p className="text-sm font-semibold text-zinc-900">
                {tokenAmount.toLocaleString()}
              </p>
            </div>
            <Slider
              value={[tokenAmount]}
              min={effectiveMin}
              max={maxTokens}
              step={100_000}
              onValueChange={(value) => setTokenAmount(value[0] ?? effectiveMin)}
              disabled={!canBuy}
            />
            <div className="flex flex-wrap gap-2">
              {[100_000, 500_000, 1_000_000].map((amount) => (
                <Button
                  key={amount}
                  variant={tokenAmount === amount ? 'default' : 'outline'}
                  onClick={() => setTokenAmount(amount)}
                  disabled={!canBuy || amount > maxTokens}
                >
                  {amount >= 1_000_000 ? '1M' : `${amount / 1000}K`}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            <div className="flex items-center justify-between">
              <span>Tokens</span>
              <span className="font-medium text-zinc-900">{tokenAmount.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Price</span>
              <span className="font-medium text-zinc-900">{formatCurrency(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Platform fee</span>
              <span className="font-medium text-zinc-900">{formatCurrency(platformFee)}</span>
            </div>
            <div className="mt-3 border-t border-zinc-200 pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900">Total</span>
              <span className="text-sm font-semibold text-zinc-900">{formatCurrency(total)}</span>
            </div>
          </div>

          <Button className="w-full" disabled={!canBuy || submitting} onClick={handleCheckout}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating checkout...
              </span>
            ) : (
              'Pay with Stripe'
            )}
          </Button>
          {!canBuy && (
            <p className="text-xs text-rose-500">
              This listing has fewer than 100K tokens remaining.
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

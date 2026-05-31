'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ListingCard } from '@/components/listings/ListingCard'
import { ListingFilters, ListingFilterState } from '@/components/listings/ListingFilters'
import { Button } from '@/components/ui/button'

export type ListingWithStats = {
  id: string
  provider: string
  model: string
  tokensForSale: number
  tokensRemaining: number
  pricePerMillionTokens: number
  status: string
  createdAt: string
  sellerName: string | null
}

const defaultFilters: ListingFilterState = {
  provider: 'all',
  model: '',
  maxPrice: '',
  minTokens: '',
  sort: 'price_asc',
}

export function ListingGrid({ listings }: { listings: ListingWithStats[] }) {
  const [filters, setFilters] = useState<ListingFilterState>(defaultFilters)

  const models = useMemo(() => {
    const base = filters.provider === 'all'
      ? listings
      : listings.filter((listing) => listing.provider === filters.provider)
    return Array.from(new Set(base.map((listing) => listing.model)))
  }, [filters.provider, listings])

  const filtered = useMemo(() => {
    const maxPrice = Number(filters.maxPrice)
    const minTokens = Number(filters.minTokens)

    let result = listings.filter((listing) => {
      if (filters.provider !== 'all' && listing.provider !== filters.provider) return false
      if (filters.model && listing.model !== filters.model) return false
      if (Number.isFinite(maxPrice) && maxPrice > 0 && listing.pricePerMillionTokens > maxPrice) {
        return false
      }
      if (Number.isFinite(minTokens) && minTokens > 0 && listing.tokensRemaining < minTokens) {
        return false
      }
      return true
    })

    if (filters.sort === 'price_asc') {
      result = result.sort((a, b) => a.pricePerMillionTokens - b.pricePerMillionTokens)
    }
    if (filters.sort === 'price_desc') {
      result = result.sort((a, b) => b.pricePerMillionTokens - a.pricePerMillionTokens)
    }
    if (filters.sort === 'mostTokens') {
      result = result.sort((a, b) => b.tokensRemaining - a.tokensRemaining)
    }
    if (filters.sort === 'newest') {
      result = result.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    }

    return result
  }, [filters, listings])

  return (
    <div className="space-y-6">
      <ListingFilters filters={filters} models={models} onChange={setFilters} />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <p className="text-lg font-semibold text-zinc-900">No listings available</p>
          <p className="mt-2 text-sm text-zinc-500">Be the first to sell API credits.</p>
          <Button asChild className="mt-4">
            <Link href="/sell">Be the first to sell</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  )
}

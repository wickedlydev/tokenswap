export type Provider = 'openai'
export type ListingStatus = 'active' | 'paused' | 'depleted' | 'cancelled'
export type PurchaseStatus = 'pending' | 'active' | 'depleted' | 'refunded'

export interface ListingWithStats {
  id: string
  provider: Provider
  model: string
  tokensForSale: number
  tokensRemaining: number
  pricePerMillionTokens: number
  status: ListingStatus
  createdAt: string
  sellerName: string | null
}

export interface PurchaseWithListing {
  id: string
  proxyKey: string
  tokensPurchased: number
  tokensRemaining: number
  totalPaidCents: number
  status: PurchaseStatus
  createdAt: string
  listing: {
    provider: Provider
    model: string
  }
}

export interface VaultItem {
  id: string
  provider: Provider
  label: string
  isValid: boolean
  createdAt: string
}

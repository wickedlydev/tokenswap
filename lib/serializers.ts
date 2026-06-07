import type { ApiKeyVault, Listing, Purchase, UsageLog } from '@prisma/client'

export function toVaultDTO(v: Pick<ApiKeyVault, 'id' | 'provider' | 'label' | 'isValid' | 'createdAt'>) {
  return {
    id: v.id,
    provider: v.provider,
    label: v.label,
    isValid: v.isValid,
    createdAt: v.createdAt.toISOString(),
  }
}

export function toListingDTO(
  l: Pick<
    Listing,
    | 'id'
    | 'provider'
    | 'model'
    | 'tokensForSale'
    | 'tokensRemaining'
    | 'pricePerMillionTokens'
    | 'status'
    | 'createdAt'
  >,
  sellerName: string | null
) {
  return {
    id: l.id,
    provider: l.provider,
    model: l.model,
    tokensForSale: l.tokensForSale,
    tokensRemaining: l.tokensRemaining,
    pricePerMillionTokens: l.pricePerMillionTokens,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    sellerName,
  }
}

export function toPurchaseListDTO(p: Purchase & { listing: { provider: string; model: string } }) {
  return {
    id: p.id,
    listingId: p.listingId,
    proxyKey: null as null,
    tokensPurchased: p.tokensPurchased,
    tokensRemaining: p.tokensRemaining,
    totalPaidCents: p.totalPaidCents,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    listing: p.listing,
  }
}

export function toPurchaseDetailDTO(
  p: Purchase & { listing: { provider: string; model: string } }
) {
  return {
    ...toPurchaseListDTO(p),
    proxyKey: `ts-${p.proxyKey}`,
  }
}

export function toUsageLogDTO(u: UsageLog) {
  return {
    id: u.id,
    promptTokens: u.promptTokens,
    completionTokens: u.completionTokens,
    totalTokens: u.totalTokens,
    model: u.model,
    requestDurationMs: u.requestDurationMs,
    createdAt: u.createdAt.toISOString(),
  }
}

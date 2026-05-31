'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function getSellerData() {
  const session = await auth()
  if (!session?.user?.id) {
    return { vaults: [], listings: [] }
  }

  const [vaults, listings] = await Promise.all([
    db.apiKeyVault.findMany({
      where: { userId: session.user.id },
      select: { id: true, provider: true, label: true, isValid: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.listing.findMany({
      where: { sellerId: session.user.id },
      select: {
        id: true,
        provider: true,
        model: true,
        tokensForSale: true,
        tokensRemaining: true,
        pricePerMillionTokens: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return {
    vaults: vaults.map((vault) => ({
      ...vault,
      createdAt: vault.createdAt.toISOString(),
    })),
    listings: listings.map((listing) => ({
      ...listing,
      createdAt: listing.createdAt.toISOString(),
    })),
  }
}

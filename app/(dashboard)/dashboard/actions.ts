'use server'

import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function getDashboardData() {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      userName: null,
      listings: [],
      purchases: [],
      sellerStats: null,
      buyerStats: null,
      recentActivity: [],
      isNewUser: true,
    }
  }

  const userId = session.user.id

  const [listings, purchases, sellerPurchases, usageLogs, usageTotals] = await Promise.all([
    db.listing.findMany({
      where: { sellerId: userId },
      select: {
        id: true,
        tokensForSale: true,
        tokensRemaining: true,
        pricePerMillionTokens: true,
        status: true,
      },
    }),
    db.purchase.findMany({
      where: { buyerId: userId },
      select: {
        id: true,
        tokensPurchased: true,
        tokensRemaining: true,
        totalPaidCents: true,
        status: true,
        createdAt: true,
        listing: { select: { model: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.purchase.findMany({
      where: { listing: { sellerId: userId } },
      select: { buyerId: true, tokensPurchased: true, listing: { select: { pricePerMillionTokens: true } } },
    }),
    db.usageLog.findMany({
      where: { purchase: { buyerId: userId } },
      select: { id: true, totalTokens: true, model: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.usageLog.aggregate({
      where: { purchase: { buyerId: userId } },
      _sum: { totalTokens: true },
    }),
  ])

  const activeListings = listings.filter((listing) => listing.status === 'active')
  const tokensListed = activeListings.reduce((sum, listing) => sum + listing.tokensRemaining, 0)
  const tokensSold = listings.reduce(
    (sum, listing) => sum + Math.max(0, listing.tokensForSale - listing.tokensRemaining),
    0
  )
  const totalBuyers = new Set(sellerPurchases.map((purchase) => purchase.buyerId)).size
  const estimatedEarnings = sellerPurchases.reduce((sum, purchase) => {
    const tokensSoldAmount = purchase.tokensPurchased
    const price = purchase.listing.pricePerMillionTokens
    return sum + (tokensSoldAmount / 1_000_000) * price * 0.9
  }, 0)

  const buyerActivePurchases = purchases.filter((purchase) => purchase.status === 'active')
  const totalTokensRemaining = buyerActivePurchases.reduce(
    (sum, purchase) => sum + purchase.tokensRemaining,
    0
  )
  const totalSpent = purchases.reduce((sum, purchase) => sum + purchase.totalPaidCents, 0)
  const totalTokensUsed = usageTotals._sum.totalTokens ?? 0

  const recentPurchases = purchases.slice(0, 10).map((purchase) => ({
    id: purchase.id,
    type: 'purchase' as const,
    createdAt: purchase.createdAt,
    label: `Purchased ${purchase.tokensPurchased.toLocaleString()} tokens for ${purchase.listing.model}`,
  }))

  const recentUsage = usageLogs.map((log) => ({
    id: log.id,
    type: 'usage' as const,
    createdAt: log.createdAt,
    label: `Used ${log.totalTokens.toLocaleString()} tokens on ${log.model}`,
  }))

  const recentActivity = [...recentUsage, ...recentPurchases]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)

  const sellerStats = listings.length
    ? {
        totalListings: activeListings.length,
        tokensListed,
        totalBuyers,
        estimatedEarnings,
      }
    : null

  const buyerStats = purchases.length
    ? {
        activeKeys: buyerActivePurchases.length,
        totalTokensRemaining,
        totalSpent,
        totalTokensUsed,
      }
    : null

  return {
    userName: session.user.name ?? session.user.email ?? null,
    listings,
    purchases,
    sellerStats,
    buyerStats,
    recentActivity: recentActivity.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    isNewUser: listings.length === 0 && purchases.length === 0,
  }
}

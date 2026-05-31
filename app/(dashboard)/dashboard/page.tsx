import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { ArrowRight, Tag, Coins, BarChart3 } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();

  const [purchases, listings] = await Promise.all([
    db.purchase.findMany({ where: { buyerId: session?.user?.id } }),
    db.listing.findMany({
      where: { sellerId: session?.user?.id },
      include: { purchases: { select: { tokensPurchased: true, status: true } } },
    }),
  ]);

  const totalSold = listings.reduce((sum, l) => {
    const sold = l.purchases.filter((p) => p.status !== "pending").reduce((s, p) => s + p.tokensPurchased, 0);
    return sum + sold;
  }, 0);

  const totalTokensRemaining = purchases.filter((p) => p.status === "active").reduce((sum, p) => sum + p.tokensRemaining, 0);
  const totalSpend = purchases.reduce((sum, p) => sum + p.totalPaidCents, 0);
  const activeListings = listings.filter((l) => l.status === "active").length;

  const cardClass = "rounded-xl border border-zinc-200 bg-white p-6";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500 mt-1">Welcome back, {session?.user?.name || session?.user?.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2"><Tag className="h-4 w-4" /> Active Listings</div>
          <div className="text-3xl font-bold text-zinc-900">{activeListings}</div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2"><Coins className="h-4 w-4" /> Tokens Sold</div>
          <div className="text-3xl font-bold text-zinc-900">{totalSold.toLocaleString()}</div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2"><Coins className="h-4 w-4" /> Tokens Remaining</div>
          <div className="text-3xl font-bold text-zinc-900">{totalTokensRemaining.toLocaleString()}</div>
        </div>
        <div className={cardClass}>
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-2"><BarChart3 className="h-4 w-4" /> Total Spend</div>
          <div className="text-3xl font-bold text-zinc-900">${(totalSpend / 100).toFixed(2)}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/sell" className={`${cardClass} hover:border-purple-300 transition-colors group`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-zinc-900">Sell API Credits</h3>
              <p className="text-sm text-zinc-500 mt-1">List your unused tokens for sale</p>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-400 group-hover:text-purple-500 transition-colors" />
          </div>
        </Link>
        <Link href="/dashboard/buy" className={`${cardClass} hover:border-purple-300 transition-colors group`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-zinc-900">Buy API Credits</h3>
              <p className="text-sm text-zinc-500 mt-1">Browse marketplace listings</p>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-400 group-hover:text-purple-500 transition-colors" />
          </div>
        </Link>
      </div>
    </div>
  );
}

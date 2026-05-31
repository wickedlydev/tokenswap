import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { getDashboardData } from './actions'
import { StatCard } from '@/components/shared/StatCard'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export default async function DashboardPage() {
  const data = await getDashboardData()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-zinc-500">Welcome back, {data.userName ?? 'there'}</p>
      </div>

      {data.sellerStats && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Seller stats</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total listings" value={data.sellerStats.totalListings.toString()} />
            <StatCard
              label="Tokens listed"
              value={data.sellerStats.tokensListed.toLocaleString()}
            />
            <StatCard
              label="Total buyers"
              value={data.sellerStats.totalBuyers.toLocaleString()}
            />
            <StatCard
              label="Estimated earnings"
              value={formatCurrency(data.sellerStats.estimatedEarnings)}
            />
          </div>
        </section>
      )}

      {data.buyerStats && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Buyer stats</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active keys" value={data.buyerStats.activeKeys.toString()} />
            <StatCard
              label="Tokens remaining"
              value={data.buyerStats.totalTokensRemaining.toLocaleString()}
            />
            <StatCard
              label="Total spent"
              value={formatCurrency(data.buyerStats.totalSpent / 100)}
            />
            <StatCard
              label="Tokens used"
              value={data.buyerStats.totalTokensUsed.toLocaleString()}
            />
          </div>
        </section>
      )}

      {data.isNewUser && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Getting started</h2>
          <div className="mt-4 space-y-3 text-sm text-zinc-600">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
              <span>Add an API key</span>
              <Link className="text-violet-600" href="/sell">
                Go →
              </Link>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3">
              <span>Create your first listing</span>
              <Link className="text-violet-600" href="/sell">
                Go →
              </Link>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 text-zinc-400">
              <span>Share and earn</span>
              <span>Locked</span>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Recent activity</h2>
          <Link className="text-sm text-violet-600" href="/buy">
            View marketplace <ArrowRight className="inline h-4 w-4" />
          </Link>
        </div>
        {data.recentActivity.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
            No activity yet. Once you buy or sell tokens, you will see updates here.
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <ul className="space-y-4">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-zinc-700">{item.label}</span>
                  <span className="text-xs text-zinc-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

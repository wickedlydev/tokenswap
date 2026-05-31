import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

type StatCardProps = {
  label: string
  value: string
  trend?: { direction: 'up' | 'down'; value: string }
}

export function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-3xl font-semibold text-zinc-900">{value}</span>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              trend.direction === 'up' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {trend.direction === 'up' ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  )
}

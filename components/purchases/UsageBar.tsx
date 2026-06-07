'use client'

import { cn } from '@/lib/utils'

export function UsageBar({ tokensPurchased, tokensRemaining }: { tokensPurchased: number; tokensRemaining: number }) {
  const used = Math.max(0, tokensPurchased - tokensRemaining)
  const remainingPercent = tokensPurchased > 0 ? (tokensRemaining / tokensPurchased) * 100 : 0

  const colorClass =
    remainingPercent > 50
      ? 'bg-emerald-500'
      : remainingPercent >= 20
        ? 'bg-amber-500'
        : 'bg-rose-500'

  return (
    <div className="space-y-2">
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn('h-2 rounded-full transition-all', colorClass)}
          style={{ width: `${Math.min(100, Math.max(0, remainingPercent))}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {used.toLocaleString()} used · {tokensRemaining.toLocaleString()} remaining
      </p>
    </div>
  )
}

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <Skeleton className="h-20 w-full rounded-xl" />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="mt-6 space-y-2 text-center">
              <Skeleton className="h-10 w-24 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto" />
              <Skeleton className="h-5 w-32 mx-auto" />
            </div>
            <div className="mt-6 space-y-2">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="mt-6 h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

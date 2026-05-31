import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center">
      <h1 className="text-2xl font-semibold text-zinc-900">Page not found</h1>
      <p className="max-w-md text-sm text-zinc-500">
        The page you are looking for does not exist. Head back to your dashboard.
      </p>
      <Button asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  )
}

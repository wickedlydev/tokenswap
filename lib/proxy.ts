const MAX_ENTRIES = 10_000

type Entry = { count: number; resetAt: number }

const rateLimitMap = new Map<string, Entry>()

// In-memory. Single-instance only. Replace with Upstash Redis when scaling beyond 1 instance.
export function checkRateLimit(key: string, maxRequests = 60, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    if (rateLimitMap.size >= MAX_ENTRIES) evictOldest()
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}

function evictOldest() {
  let oldestKey: string | null = null
  let oldestReset = Infinity
  for (const [k, v] of rateLimitMap) {
    if (v.resetAt < oldestReset) {
      oldestReset = v.resetAt
      oldestKey = k
    }
  }
  if (oldestKey) rateLimitMap.delete(oldestKey)
}

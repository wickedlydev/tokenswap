'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { ProviderBadge } from '@/components/shared/ProviderBadge'
import { CopyButton } from '@/components/shared/CopyButton'
import { UsageBar } from '@/components/purchases/UsageBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PurchaseItem = {
  id: string
  listingId?: string
  proxyKey: string | null
  tokensPurchased: number
  tokensRemaining: number
  totalPaidCents: number
  status: string
  createdAt: string
  listing: {
    provider: string
    model: string
  }
}

type UsageLog = {
  id: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
  requestDurationMs?: number | null
  createdAt: string
}

const statusClasses: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  depleted: 'bg-rose-100 text-rose-700',
  pending: 'bg-amber-100 text-amber-700',
  pending_refund: 'bg-amber-100 text-amber-700',
  refunded: 'bg-zinc-200 text-zinc-600',
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export function PurchaseCard({ purchase }: { purchase: PurchaseItem }) {
  const [expanded, setExpanded] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [proxyKey, setProxyKey] = useState<string | null>(purchase.proxyKey)
  const [loadingKey, setLoadingKey] = useState(false)
  const [tab, setTab] = useState('integration')
  const [usageLogs, setUsageLogs] = useState<UsageLog[] | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)

  const usedTokens = Math.max(0, purchase.tokensPurchased - purchase.tokensRemaining)
  const remainingRatio = purchase.tokensPurchased
    ? purchase.tokensRemaining / purchase.tokensPurchased
    : 0
  const showTopUp = purchase.status === 'depleted' || remainingRatio < 0.1

  const displayKey = showKey && proxyKey ? proxyKey : 'ts-<your-proxy-key>'
  const maskedKey = proxyKey
    ? proxyKey.replace(/.(?=.{4})/g, '•')
    : 'ts-••••••••••••'

  const apiBase = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/api/v1`
  }, [])

  async function fetchProxyKey() {
    if (proxyKey || loadingKey) return
    setLoadingKey(true)
    try {
      const res = await fetch(`/api/purchases/${purchase.id}`)
      const data = (await res.json()) as { data?: { proxyKey?: string }; error?: string }
      if (res.ok && data.data?.proxyKey) {
        setProxyKey(data.data.proxyKey)
      } else if (!res.ok) {
        toast.error(data.error || 'Failed to load proxy key', { duration: 5000 })
      }
    } catch {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setLoadingKey(false)
    }
  }

  async function handleToggleKey() {
    if (!proxyKey) {
      await fetchProxyKey()
    }
    setShowKey((prev) => !prev)
  }

  async function loadUsage() {
    if (usageLogs || usageLoading) return
    setUsageLoading(true)
    try {
      const res = await fetch(`/api/usage?purchaseId=${purchase.id}`)
      const data = (await res.json()) as { data?: UsageLog[]; error?: string }
      if (res.ok && data.data) {
        setUsageLogs(data.data)
      } else {
        setUsageLogs([])
        toast.error(data.error || 'Failed to load usage', { duration: 5000 })
      }
    } catch {
      setUsageLogs([])
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setUsageLoading(false)
    }
  }

  const usageTotals = useMemo(() => {
    if (!usageLogs) return { prompt: 0, completion: 0, total: 0 }
    return usageLogs.reduce(
      (acc, log) => {
        acc.prompt += log.promptTokens
        acc.completion += log.completionTokens
        acc.total += log.totalTokens
        return acc
      },
      { prompt: 0, completion: 0, total: 0 }
    )
  }, [usageLogs])

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ProviderBadge provider={purchase.listing.provider} />
            <span className="text-sm font-semibold text-foreground">
              {purchase.listing.model}
            </span>
          </div>
          <Badge className={statusClasses[purchase.status] || 'bg-zinc-100 text-zinc-600'}>
            {purchase.status === 'pending_refund' ? 'pending refund' : purchase.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {showTopUp && purchase.listingId && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/buy?listingId=${purchase.listingId}`}>Top up</Link>
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={() => setExpanded((prev) => !prev)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <UsageBar tokensPurchased={purchase.tokensPurchased} tokensRemaining={purchase.tokensRemaining} />
        <p className="mt-2 text-xs text-muted-foreground">
          {usedTokens.toLocaleString()} / {purchase.tokensPurchased.toLocaleString()} tokens used
        </p>
      </div>

      {purchase.status === 'pending_refund' && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Purchase pending refund — listing was unavailable. Contact support.
        </div>
      )}

      {expanded && (
        <div className="mt-6">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value)
              if (value === 'usage') loadUsage()
            }}
          >
            <TabsList>
              <TabsTrigger value="integration">Integration</TabsTrigger>
              <TabsTrigger value="usage">Usage history</TabsTrigger>
            </TabsList>

            <TabsContent value="integration" className="mt-4">
              <div className="rounded-xl border border-border bg-muted p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-mono text-foreground">
                    {showKey && proxyKey ? proxyKey : maskedKey}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleToggleKey}
                      disabled={loadingKey}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <CopyButton value={proxyKey ?? ''} disabled={!proxyKey} />
                  </div>
                </div>
              </div>

              <Tabs defaultValue="python" className="mt-4">
                <TabsList>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="node">Node.js</TabsTrigger>
                  <TabsTrigger value="curl">curl</TabsTrigger>
                </TabsList>
                <TabsContent value="python" className="mt-3">
                  <pre className="rounded-xl bg-zinc-900 p-4 text-xs text-emerald-200">
{`from openai import OpenAI

client = OpenAI(
  base_url="${apiBase}",
  api_key="${displayKey}",
)
`}
                  </pre>
                </TabsContent>
                <TabsContent value="node" className="mt-3">
                  <pre className="rounded-xl bg-zinc-900 p-4 text-xs text-emerald-200">
{`import OpenAI from "openai"

const openai = new OpenAI({
  baseURL: "${apiBase}",
  apiKey: "${displayKey}",
})
`}
                  </pre>
                </TabsContent>
                <TabsContent value="curl" className="mt-3">
                  <pre className="rounded-xl bg-zinc-900 p-4 text-xs text-emerald-200">
{`curl ${apiBase}/chat/completions \
  -H "Authorization: Bearer ${displayKey}" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
`}
                  </pre>
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="usage" className="mt-4">
              {usageLoading && <p className="text-sm text-muted-foreground">Loading usage...</p>}
              {!usageLoading && usageLogs && usageLogs.length === 0 && (
                <p className="text-sm text-muted-foreground">No requests yet — start using your proxy key.</p>
              )}
              {!usageLoading && usageLogs && usageLogs.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDate(log.createdAt)}</TableCell>
                        <TableCell>{log.promptTokens}</TableCell>
                        <TableCell>{log.completionTokens}</TableCell>
                        <TableCell>{log.totalTokens}</TableCell>
                        <TableCell>{log.requestDurationMs ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell className="font-semibold">{usageTotals.prompt}</TableCell>
                      <TableCell className="font-semibold">{usageTotals.completion}</TableCell>
                      <TableCell className="font-semibold">{usageTotals.total}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}

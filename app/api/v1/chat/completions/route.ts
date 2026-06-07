export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { checkRateLimit } from '@/lib/proxy'

const MAX_BODY_BYTES = 1_000_000

function openaiError(status: number, message: string, type: string, code?: string) {
  return NextResponse.json({ error: { message, type, ...(code ? { code } : {}) } }, { status })
}

async function readBodyWithCap(request: NextRequest) {
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return { error: openaiError(413, 'Request body too large', 'invalid_request_error') } as const
  }
  try {
    return { body: JSON.parse(raw) as Record<string, unknown> } as const
  } catch {
    return { error: openaiError(400, 'Invalid JSON body', 'invalid_request_error') } as const
  }
}

async function applyTokenUsage(
  purchaseId: string,
  totalTokens: number,
  promptTokens: number,
  completionTokens: number,
  model: string,
  duration: number
) {
  if (totalTokens <= 0) return { applied: false, reason: 'no_usage' as const }

  return db.$transaction(async (tx) => {
    const updated = await tx.purchase.updateMany({
      where: {
        id: purchaseId,
        status: 'active',
        tokensRemaining: { gte: totalTokens },
      },
      data: { tokensRemaining: { decrement: totalTokens } },
    })

    if (updated.count === 0) {
      return { applied: false, reason: 'race' as const }
    }

    await tx.usageLog.create({
      data: {
        purchaseId,
        promptTokens,
        completionTokens,
        totalTokens,
        model,
        requestDurationMs: duration,
      },
    })

    const fresh = await tx.purchase.findUnique({
      where: { id: purchaseId },
      select: { tokensRemaining: true },
    })
    if (fresh && fresh.tokensRemaining <= 0) {
      await tx.purchase.update({
        where: { id: purchaseId },
        data: { status: 'depleted' },
      })
    }
    return { applied: true, reason: 'ok' as const }
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  const authHeader = request.headers.get('authorization') ?? ''
  const proxyKey = authHeader.startsWith('Bearer ts-')
    ? authHeader.slice('Bearer ts-'.length)
    : null

  if (!proxyKey) {
    return openaiError(401, 'Missing or invalid Authorization header. Use: Bearer ts-<proxyKey>', 'auth_error')
  }

  if (!checkRateLimit(proxyKey)) {
    return openaiError(429, 'Rate limit exceeded. Max 60 requests/minute.', 'rate_limit_error')
  }

  const purchase = await db.purchase.findUnique({
    where: { proxyKey },
    include: {
      listing: {
        include: {
          vault: { select: { encryptedKey: true, iv: true, authTag: true, provider: true } },
        },
      },
    },
  })

  if (!purchase) {
    return openaiError(401, 'Invalid proxy key', 'auth_error')
  }

  if (purchase.status !== 'active') {
    return openaiError(
      402,
      `Proxy key is ${purchase.status}. Purchase more tokens to continue.`,
      'quota_error'
    )
  }

  if (purchase.tokensRemaining <= 0) {
    await db.purchase.update({ where: { id: purchase.id }, data: { status: 'depleted' } })
    return openaiError(402, 'Token quota exhausted. Purchase more tokens.', 'quota_error')
  }

  const parsed = await readBodyWithCap(request)
  if ('error' in parsed) return parsed.error
  const body = parsed.body

  body.model = purchase.listing.model
  const isStreaming = body.stream === true
  if (isStreaming) {
    body.stream_options = { ...(body.stream_options as object | undefined), include_usage: true }
  }

  const { vault } = purchase.listing
  const realKey = decrypt(vault.encryptedKey, vault.iv, vault.authTag)

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${realKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!isStreaming) {
    const data = (await upstream.json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } }
    const duration = Date.now() - startTime

    if (upstream.ok && data.usage) {
      const promptTokens = data.usage.prompt_tokens ?? 0
      const completionTokens = data.usage.completion_tokens ?? 0
      const totalTokens = promptTokens + completionTokens

      const result = await applyTokenUsage(
        purchase.id,
        totalTokens,
        promptTokens,
        completionTokens,
        purchase.listing.model,
        duration
      )

      if (!result.applied && result.reason === 'race') {
        console.warn('[PROXY_RACE]', { purchaseId: purchase.id, totalTokens })
      }
    }

    return NextResponse.json(data, { status: upstream.status })
  }

  let promptTokens = 0
  let completionTokens = 0
  let usageRecorded = false
  let sseBuffer = ''

  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      sseBuffer += new TextDecoder().decode(chunk)
      const events = sseBuffer.split('\n\n')
      sseBuffer = events.pop() ?? ''

      for (const event of events) {
        const dataLine = event.split('\n').find((line) => line.startsWith('data: '))
        if (!dataLine) continue
        const payload = dataLine.slice(6).trim()
        if (payload === '[DONE]') continue
        try {
          const parsedChunk = JSON.parse(payload) as {
            usage?: { prompt_tokens?: number; completion_tokens?: number }
          }
          if (parsedChunk.usage) {
            promptTokens = parsedChunk.usage.prompt_tokens ?? promptTokens
            completionTokens = parsedChunk.usage.completion_tokens ?? completionTokens
          }
        } catch {
          // not JSON; non-fatal
        }
      }
      controller.enqueue(chunk)
    },
    async flush() {
      if (usageRecorded) return
      const totalTokens = promptTokens + completionTokens
      if (totalTokens <= 0) return
      usageRecorded = true
      const duration = Date.now() - startTime
      const result = await applyTokenUsage(
        purchase.id,
        totalTokens,
        promptTokens,
        completionTokens,
        purchase.listing.model,
        duration
      )
      if (!result.applied && result.reason === 'race') {
        console.warn('[PROXY_RACE]', { purchaseId: purchase.id, totalTokens })
      }
    },
  })

  if (!upstream.body) {
    return openaiError(502, 'Upstream returned no body', 'upstream_error')
  }

  return new Response(upstream.body.pipeThrough(stream), {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

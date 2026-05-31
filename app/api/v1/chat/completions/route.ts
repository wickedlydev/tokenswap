import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(proxyKey: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(proxyKey)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(proxyKey, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  const authHeader = request.headers.get('authorization') ?? ''
  const proxyKey = authHeader.startsWith('Bearer ts-')
    ? authHeader.slice('Bearer ts-'.length)
    : null

  if (!proxyKey) {
    return NextResponse.json(
      {
        error: {
          message: 'Missing or invalid Authorization header. Use: Bearer ts-<proxyKey>',
          type: 'auth_error',
        },
      },
      { status: 401 }
    )
  }

  if (!checkRateLimit(proxyKey)) {
    return NextResponse.json(
      {
        error: {
          message: 'Rate limit exceeded. Max 60 requests/minute.',
          type: 'rate_limit_error',
        },
      },
      { status: 429 }
    )
  }

  const purchase = await db.purchase.findUnique({
    where: { proxyKey },
    include: {
      listing: {
        include: { vault: { select: { encryptedKey: true, iv: true, authTag: true, provider: true } } },
      },
    },
  })

  if (!purchase) {
    return NextResponse.json(
      { error: { message: 'Invalid proxy key', type: 'auth_error' } },
      { status: 401 }
    )
  }

  if (purchase.status !== 'active') {
    return NextResponse.json(
      {
        error: {
          message: `Proxy key is ${purchase.status}. Purchase more tokens to continue.`,
          type: 'quota_error',
        },
      },
      { status: 402 }
    )
  }

  if (purchase.tokensRemaining <= 0) {
    await db.purchase.update({ where: { id: purchase.id }, data: { status: 'depleted' } })
    return NextResponse.json(
      { error: { message: 'Token quota exhausted. Purchase more tokens.', type: 'quota_error' } },
      { status: 402 }
    )
  }

  const { vault } = purchase.listing
  const realKey = decrypt(vault.encryptedKey, vault.iv, vault.authTag)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body' } }, { status: 400 })
  }

  body.model = purchase.listing.model

  const isStreaming = body.stream === true

  const provider = purchase.listing.vault.provider
  const forwardHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (provider === 'openai') {
    forwardHeaders['Authorization'] = `Bearer ${realKey}`
  } else if (provider === 'anthropic') {
    forwardHeaders['x-api-key'] = realKey
    forwardHeaders['anthropic-version'] = '2023-06-01'
  }

  const providerUrl =
    provider === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.anthropic.com/v1/messages'

  const upstream = await fetch(providerUrl, {
    method: 'POST',
    headers: forwardHeaders,
    body: JSON.stringify(body),
  })

  if (!isStreaming) {
    const data = (await upstream.json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } }
    const duration = Date.now() - startTime

    if (upstream.ok && data.usage) {
      const promptTokens = data.usage.prompt_tokens ?? 0
      const completionTokens = data.usage.completion_tokens ?? 0
      const totalTokens = promptTokens + completionTokens

      await db.$transaction([
        db.usageLog.create({
          data: {
            purchaseId: purchase.id,
            promptTokens,
            completionTokens,
            totalTokens,
            model: purchase.listing.model,
            requestDurationMs: duration,
          },
        }),
        db.purchase.update({
          where: { id: purchase.id },
          data: { tokensRemaining: { decrement: totalTokens } },
        }),
      ])

      if (purchase.tokensRemaining - totalTokens <= 0) {
        await db.purchase.update({
          where: { id: purchase.id },
          data: { status: 'depleted' },
        })
      }
    }

    return NextResponse.json(data, { status: upstream.status })
  }

  const encoder = new TextEncoder()
  let promptTokens = 0
  let completionTokens = 0
  let usageLogged = false

  const stream = new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk)
      const lines = text.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              usage?: { prompt_tokens?: number; completion_tokens?: number }
            }
            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens ?? 0
              completionTokens = parsed.usage.completion_tokens ?? 0
            }
          } catch {
            // ignore parse errors on streaming chunks
          }
        }
      }
      controller.enqueue(chunk)
    },
    async flush() {
      if (!usageLogged && promptTokens + completionTokens > 0) {
        usageLogged = true
        const totalTokens = promptTokens + completionTokens
        const duration = Date.now() - startTime
        await db.$transaction([
          db.usageLog.create({
            data: {
              purchaseId: purchase.id,
              promptTokens,
              completionTokens,
              totalTokens,
              model: purchase.listing.model,
              requestDurationMs: duration,
            },
          }),
          db.purchase.update({
            where: { id: purchase.id },
            data: { tokensRemaining: { decrement: totalTokens } },
          }),
        ])
      }
    },
  })

  return new Response(upstream.body!.pipeThrough(stream), {
    status: upstream.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

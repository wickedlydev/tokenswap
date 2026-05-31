import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { encrypt } from '@/lib/crypto'

function looksLikeApiKey(apiKey: string): boolean {
  return apiKey.trim().length >= 20
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const vaults = await db.apiKeyVault.findMany({
      where: { userId: session.user.id },
      select: { id: true, provider: true, label: true, isValid: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: vaults })
  } catch (error) {
    console.error('[VAULT_GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      provider?: string
      label?: string
      apiKey?: string
    }

    const provider = body.provider?.trim()
    const label = body.label?.trim()
    const apiKey = body.apiKey?.trim()

    if (!provider || !label || !apiKey || !looksLikeApiKey(apiKey)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    if (provider !== 'openai' && provider !== 'anthropic') {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    let response: Response
    try {
      if (provider === 'openai') {
        response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
      } else {
        response = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        })
      }
    } catch (error) {
      console.error('[VAULT_VERIFY]', error)
      return NextResponse.json({ error: 'Failed to verify API key' }, { status: 502 })
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Failed to verify API key' }, { status: 502 })
    }

    const { encryptedKey, iv, authTag } = encrypt(apiKey)

    const vault = await db.apiKeyVault.create({
      data: {
        userId: session.user.id,
        provider,
        label,
        encryptedKey,
        iv,
        authTag,
        isValid: true,
      },
    })

    return NextResponse.json(
      {
        data: {
          id: vault.id,
          provider: vault.provider,
          label: vault.label,
          isValid: vault.isValid,
          createdAt: vault.createdAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[VAULT_POST]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

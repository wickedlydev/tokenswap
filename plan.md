# TokenSwap — MVP Production-Readiness Plan

> Read `agent.md` first. This file is the executable backlog. Work the phases in order. Each phase has a verification step — run it before moving on.

## Context

The project is substantially scaffolded — landing, auth, dashboard layout, all five dashboard pages, all major API routes (vault, listings, checkout, webhook, purchases, usage, user, proxy), AES-256-GCM crypto, Stripe checkout + webhook, NextAuth v5 with Credentials, sonner toasts, shadcn UI, and a working seed all exist. What's missing is the gap between "scaffolded" and "production-ready MVP": Next 16 async-API drift, token-accounting race conditions, webhook idempotency, OpenAI-only scope tightening, schema migrations, env validation, tests, CI, and deployment hygiene.

This plan turns the scaffold into a launchable MVP demo. Decisions baked in (see `agent.md` for context):
- **OpenAI only at MVP.** Anthropic and others deferred.
- **Stripe test mode at launch.** Demo posture, no real money, no payouts.
- **SQLite for local dev, Postgres for CI/prod.**
- **Critical-path tests + GitHub Actions CI.** No coverage targets.
- **Stripe Connect Express payouts in V2** — separate plan section at the bottom.

---

## Phase 0 — Pre-flight

Before writing any code, do these once.

- Read `agent.md` end to end.
- `git status` — must be clean. If not, ask the user before proceeding.
- `git ls-files | grep -E '^\.env'` — if anything tracked, stop and tell the user. They will need to remove it from history and rotate the leaked secrets.
- Confirm `.env.local` exists with all variables from the env section of `agent.md`. If `ENCRYPTION_KEY` is missing or not a 64-char hex string, generate one:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Add to `.env.local`. Don't commit.
- `npm install` — must complete clean.
- `npx prisma generate` — must succeed.

Verification: `npm run dev` starts and `http://localhost:3000` loads without runtime errors.

---

## Phase 1 — Next 16 compatibility & build hygiene

Critical: `next@16.2.6` and `react@19` are pinned. Several patterns are still Next 14/15 style and will warn or fail at build/runtime.

### 1a. Async dynamic params

Apply this pattern to every dynamic route:

```ts
// before
{ params }: { params: { id: string } }
const { id } = params

// after
{ params }: { params: Promise<{ id: string }> }
const { id } = await params
```

Files:
- `app/api/vault/[id]/route.ts` — DELETE handler
- `app/api/listings/[id]/route.ts` — GET, PATCH, DELETE
- `app/api/purchases/[id]/route.ts` — GET

### 1b. Async searchParams and cookies

In `app/(dashboard)/keys/page.tsx`:

```ts
import { cookies } from 'next/headers'

export default async function KeysPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string }>
}) {
  const params = (await searchParams) ?? {}
  const showSuccess = params.success === 'true'
  const cookieStore = await cookies()
  const res = await fetch(`${appUrl}/api/purchases`, {
    cache: 'no-store',
    headers: { cookie: cookieStore.toString() },
  })
  // ...
}
```

### 1c. Drop Pages-Router config from webhook

In `app/api/webhook/route.ts`, remove:
```ts
export const config = { api: { bodyParser: false } } // ← delete
```
Add:
```ts
export const runtime = 'nodejs' // Stripe SDK requires Node, not Edge
```

### 1d. Stripe API version pinning

`stripe@22.x` is installed but `lib/stripe.ts` pins `apiVersion: '2024-06-20'`. Update to the version the SDK is built against (check `node_modules/stripe/types/lib.d.ts` for `LatestApiVersion` — typically `'2025-08-27.basil'` for Stripe SDK 18+ / API version 2025; for v22 it's likely `'2024-09-30.acacia'` or similar). Pick the SDK's default and pin it explicitly. Document in `agent.md`.

### Verification

```powershell
npm run build
npx tsc --noEmit
```
Both must pass with **zero errors and zero `params should be awaited` warnings**.

---

## Phase 2 — Proxy correctness

The proxy is the product. Three correctness bugs and one scope reduction.

### 2a. Atomic token accounting

`app/api/v1/chat/completions/route.ts` currently does:
1. Read purchase
2. Forward to OpenAI
3. Two separate `db.$transaction([usageLog.create, purchase.update])` calls
4. Read updated purchase, then maybe update status to depleted

Two problems:
- Concurrent requests against the same proxyKey can both pass step 1's tokensRemaining check and both decrement, producing negative `tokensRemaining`.
- The depletion update is outside the transaction — if the process crashes between, status stays `active` while tokens are 0.

Fix with a conditional `updateMany`:

```ts
const usageData = {
  purchaseId: purchase.id,
  promptTokens,
  completionTokens,
  totalTokens,
  model: purchase.listing.model,
  requestDurationMs: duration,
}

const result = await db.$transaction(async (tx) => {
  const updated = await tx.purchase.updateMany({
    where: {
      id: purchase.id,
      status: 'active',
      tokensRemaining: { gte: totalTokens },
    },
    data: { tokensRemaining: { decrement: totalTokens } },
  })

  if (updated.count === 0) {
    return { applied: false }
  }

  await tx.usageLog.create({ data: usageData })

  // Read fresh state and flip to depleted if at zero
  const fresh = await tx.purchase.findUnique({
    where: { id: purchase.id },
    select: { tokensRemaining: true },
  })
  if (fresh && fresh.tokensRemaining <= 0) {
    await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: 'depleted' },
    })
  }
  return { applied: true }
})
```

If `result.applied === false`, the buyer raced past their quota. Return the OpenAI response anyway (we already paid the upstream cost) but flag a structured warning log: `[PROXY_RACE]` with `{ purchaseId, totalTokens }`.

Apply the same pattern in the streaming `flush()`.

### 2b. Streaming SSE buffering

The current parser splits each chunk on `\n` and tries to read `data: ` lines. SSE event boundaries are `\n\n`, and a single event can span chunks. Replace with a buffered parser:

```ts
let sseBuffer = ''

const stream = new TransformStream<Uint8Array, Uint8Array>({
  transform(chunk, controller) {
    sseBuffer += new TextDecoder().decode(chunk)
    const events = sseBuffer.split('\n\n')
    sseBuffer = events.pop() ?? '' // last partial event stays in buffer

    for (const event of events) {
      const dataLine = event.split('\n').find((line) => line.startsWith('data: '))
      if (!dataLine) continue
      const payload = dataLine.slice(6).trim()
      if (payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload) as {
          usage?: { prompt_tokens?: number; completion_tokens?: number }
        }
        if (parsed.usage) {
          promptTokens = parsed.usage.prompt_tokens ?? promptTokens
          completionTokens = parsed.usage.completion_tokens ?? completionTokens
        }
      } catch {
        // not JSON — non-fatal
      }
    }
    controller.enqueue(chunk)
  },
  async flush() {
    // atomic decrement + depletion (same as 2a)
  },
})
```

Force OpenAI to include usage in streaming by injecting:
```ts
if (isStreaming) {
  body.stream_options = { ...(body.stream_options as object | undefined), include_usage: true }
}
```

### 2c. OpenAI-only scope (drop Anthropic)

Files to change:
- `lib/providers.ts` — drop the `anthropic` block. Keep `openai` only.
- `app/api/vault/route.ts` — replace `provider !== 'openai' && provider !== 'anthropic'` with `provider !== 'openai'`. Drop the Anthropic verify branch (only call OpenAI's `/v1/models`).
- `app/api/v1/chat/completions/route.ts` — single OpenAI forwarding path. Drop the `if (provider === 'anthropic')` branches and the alternate URL.
- `components/vault/AddKeyModal.tsx` — `providers` array becomes OpenAI-only. Make selection a no-op or hide the step entirely.
- `components/listings/ListingFilters.tsx` — drop `anthropic` and `groq` tabs. Keep `all` and `openai`.
- `types/index.ts` — `Provider = 'openai'`.
- `prisma/seed.ts` — drop the Anthropic seller and listing. Add 2 more OpenAI listings (gpt-4-turbo at $6/1M, gpt-3.5-turbo at $0.30/1M).

Schema's `provider String` field stays free-form for V1.1.

### 2d. Hardening

In the proxy:
- **Body size cap.** Read as text, reject if `> 1_000_000` bytes, then parse:
  ```ts
  const raw = await request.text()
  if (raw.length > 1_000_000) return openaiError(413, 'Request body too large', 'invalid_request_error')
  const body = JSON.parse(raw) as Record<string, unknown>
  ```
- **OpenAI-shaped errors.** Add a helper:
  ```ts
  function openaiError(status: number, message: string, type: string, code?: string) {
    return NextResponse.json({ error: { message, type, code } }, { status })
  }
  ```
  Use it for every error response from the proxy.
- **No secret in logs.** Audit existing logs in this file. Allowed log fields: `provider, model, status, durationMs, purchaseId, requestId`.
- **Add at top of file:**
  ```ts
  export const runtime = 'nodejs'
  export const dynamic = 'force-dynamic'
  ```

### Verification

- `npm run build` passes.
- Manual: with the proxy running, run two concurrent curl loops against a near-depleted purchase; tokensRemaining must never go negative.
- Manual: `curl` with `stream: true` and `stream_options: { include_usage: true }`; usage row appears with realistic `promptTokens` and `completionTokens`.
- Manual: send a 2 MB body — get a 413 with OpenAI-shaped error.

---

## Phase 3 — Webhook & checkout correctness

### 3a. Schema: `Purchase.stripeSessionId @unique`

Edit `prisma/schema.prisma`:

```prisma
model Purchase {
  // ...
  stripeSessionId String? @unique
  // ...
}
```

Run `npx prisma db push` (dev) or `npx prisma migrate dev --name purchase_stripe_session_unique` (when migrations are set up in Phase 4).

### 3b. Webhook idempotency

In `app/api/webhook/route.ts`, before creating the Purchase:

```ts
const existing = await db.purchase.findUnique({
  where: { stripeSessionId: stripeSession.id },
})
if (existing) {
  return NextResponse.json({ received: true, idempotent: true })
}
```

### 3c. Atomic listing decrement in webhook

Replace the read-then-update with a guarded `updateMany`:

```ts
await db.$transaction(async (tx) => {
  // idempotency check inside transaction
  const dup = await tx.purchase.findUnique({
    where: { stripeSessionId: stripeSession.id },
    select: { id: true },
  })
  if (dup) return

  const decrement = await tx.listing.updateMany({
    where: {
      id: listingId,
      status: 'active',
      tokensRemaining: { gte: tokenAmount },
    },
    data: { tokensRemaining: { decrement: tokenAmount } },
  })

  if (decrement.count === 0) {
    // Listing changed between checkout and webhook (paused, depleted, cancelled).
    // Create the Purchase as 'pending_refund' so the buyer sees the issue and ops can refund.
    await tx.purchase.create({
      data: {
        buyerId,
        listingId,
        tokensPurchased: tokenAmount,
        tokensRemaining: 0,
        totalPaidCents: stripeSession.amount_total ?? 0,
        platformFeeCents,
        stripeSessionId: stripeSession.id,
        stripePaymentId: typeof stripeSession.payment_intent === 'string'
          ? stripeSession.payment_intent
          : null,
        status: 'pending_refund',
      },
    })
    console.error('[WEBHOOK_LISTING_UNAVAILABLE]', { listingId, tokenAmount, sessionId: stripeSession.id })
    return
  }

  await tx.purchase.create({
    data: {
      buyerId,
      listingId,
      tokensPurchased: tokenAmount,
      tokensRemaining: tokenAmount,
      totalPaidCents: stripeSession.amount_total ?? 0,
      platformFeeCents,
      stripeSessionId: stripeSession.id,
      stripePaymentId: typeof stripeSession.payment_intent === 'string'
        ? stripeSession.payment_intent
        : null,
      status: 'active',
    },
  })

  // After decrement, check if listing hit zero
  const listingAfter = await tx.listing.findUnique({
    where: { id: listingId },
    select: { tokensRemaining: true },
  })
  if (listingAfter && listingAfter.tokensRemaining <= 0) {
    await tx.listing.update({
      where: { id: listingId },
      data: { status: 'depleted' },
    })
  }
})
```

Add `'pending_refund'` to the documented `Purchase.status` values in `agent.md`. Surface it in `PurchaseCard` with an amber banner: "Purchase pending refund — listing was unavailable. Contact support."

### 3d. Webhook event coverage

For unhandled event types, log info-level and return 200:

```ts
} else {
  console.info('[WEBHOOK_UNHANDLED]', event.type)
}
return NextResponse.json({ received: true })
```

Specifically handle (no-op with logging) `checkout.session.expired`, `payment_intent.payment_failed` — they shouldn't 500.

### 3e. Checkout race-window comment

In `app/api/checkout/route.ts`, add a top-of-function comment noting the webhook is the source of truth and pre-checks here are best-effort. No code changes needed.

### Verification

- Trigger same `stripe listen` event twice (`stripe trigger checkout.session.completed` doubles or replay) — only one Purchase row.
- Pause a listing, then complete a checkout that was started before the pause — Purchase row created with `status='pending_refund'`, `/keys` shows the banner.
- Send a `payment_intent.payment_failed` event — webhook returns 200, doesn't crash.

---

## Phase 4 — Schema, env, and ops baseline

### 4a. Postgres for CI and prod

Keep SQLite for local quickstart. Add Postgres parity for CI / prod.

- Add `docker-compose.yml` at repo root:
  ```yaml
  services:
    db:
      image: postgres:16
      environment:
        POSTGRES_USER: tokenswap
        POSTGRES_PASSWORD: tokenswap
        POSTGRES_DB: tokenswap
      ports: ['5432:5432']
      volumes: ['tokenswap_pg:/var/lib/postgresql/data']
  volumes:
    tokenswap_pg:
  ```
- `.env.example` shows both options for `DATABASE_URL`:
  ```
  # local SQLite
  DATABASE_URL="file:./dev.db"
  # local Postgres (docker compose up)
  # DATABASE_URL="postgresql://tokenswap:tokenswap@localhost:5432/tokenswap"
  ```
- `prisma/schema.prisma` stays `provider = "sqlite"` on the developer's `main` branch. For CI and prod, the engineer flips to `postgresql` and runs migrations. To avoid two schemas, document that the CI flow uses `DATABASE_PROVIDER=postgresql` injected via a small script (or accept the manual flip — for MVP, keep it simple and tell the user to flip the provider when deploying).
- Initialize migrations: `npx prisma migrate dev --name init` against a Postgres URL once. Commit `prisma/migrations/`. Switch local quickstart docs to mention `npx prisma db push` (SQLite) vs `npx prisma migrate deploy` (Postgres prod).

### 4b. User-deletion safety

`onDelete: Cascade` on `User → ApiKeyVault → Listing → Purchase` is dangerous: a seller with active buyer purchases can delete their account and the buyers' proxy keys point at orphaned (decryptable but cascaded-away) vaults.

Fix in `app/api/user/route.ts` DELETE handler:

```ts
const activeBuyerPurchases = await db.purchase.count({
  where: {
    status: { in: ['active', 'pending'] },
    listing: { sellerId: session.user.id },
  },
})
if (activeBuyerPurchases > 0) {
  return NextResponse.json(
    {
      error:
        'Cannot delete account while buyers have active proxy keys against your listings. Pause your listings and wait for purchases to deplete or contact support.',
    },
    { status: 409 }
  )
}
```

Also check the seller's own active purchases (the user is a buyer too) — refuse if any are `active` to avoid surprising the buyer.

Better long-term answer is soft delete (out of MVP). For MVP, the refusal above is enough.

### 4c. Env validation at boot

New `lib/env.ts`:

```ts
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 64-char hex (32 bytes)'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const formatted = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment variables:\n${formatted}`)
}

export const env = parsed.data
```

Import once at the top of `lib/db.ts` so any code path that uses the database has validated env first. Don't import in client components.

Then update:
- `lib/crypto.ts` — at module load, validate `ENCRYPTION_KEY` shape explicitly so the error is locally clear.
- `lib/stripe.ts` — same for `STRIPE_SECRET_KEY`.

### 4d. Rate limiter cap

`lib/proxy.ts` has the rate-limit map but the proxy route uses its own. Consolidate:

- Move the rate limiter from the proxy route into `lib/proxy.ts`.
- Add `MAX_ENTRIES = 10_000` with LRU-style eviction (or simpler: when size > MAX, drop the entry with the oldest `resetAt`).
- Add comment: `// In-memory. Single-instance only. Replace with Upstash Redis when scaling beyond 1 instance.`
- Document the limitation in `agent.md`.

### 4e. `.env` hygiene

- Confirm `.gitignore` has `.env*` (it does).
- `git ls-files | grep -E '^\.env'` — if any `.env*` is tracked, tell the user. Don't fix automatically — leaked-secret rotation is the user's call.
- Add `.env.example` with all required keys (empty values) and commit it. Use this as the template the README quickstart references.

### Verification

- Booting with a missing or malformed env var throws clearly at startup.
- `docker compose up db` works locally; switching `DATABASE_URL` to the Postgres URL and running `npx prisma migrate dev` succeeds.
- Account-delete with active buyer purchases returns 409 with the documented message.

---

## Phase 5 — Auth & data hardening

### 5a. Single register path

`lib/auth.ts` `Credentials.authorize()` has a `mode: 'register'` branch that overlaps with `/api/auth/register/route.ts`. Pick one — the `/api/auth/register` route returns proper 201/409 statuses and is cleaner.

In `lib/auth.ts`:
- Remove the `name`, `mode` from the `credentials` config.
- Drop the `if (mode === 'register')` branch from `authorize()`. Login-only.

Then in `app/(auth)/register/page.tsx`, ensure it POSTs to `/api/auth/register` and then calls `signIn('credentials', { email, password, redirect: false })`. If it currently passes `mode: 'register'` to `signIn`, update.

### 5b. DTO serializers

New `lib/serializers.ts`:

```ts
import type { ApiKeyVault, Listing, Purchase, UsageLog, User } from '@prisma/client'

export function toVaultDTO(v: Pick<ApiKeyVault, 'id' | 'provider' | 'label' | 'isValid' | 'createdAt'>) {
  return {
    id: v.id,
    provider: v.provider,
    label: v.label,
    isValid: v.isValid,
    createdAt: v.createdAt.toISOString(),
  }
}

export function toListingDTO(
  l: Pick<Listing, 'id' | 'provider' | 'model' | 'tokensForSale' | 'tokensRemaining' | 'pricePerMillionTokens' | 'status' | 'createdAt'>,
  sellerName: string | null
) {
  return {
    id: l.id,
    provider: l.provider,
    model: l.model,
    tokensForSale: l.tokensForSale,
    tokensRemaining: l.tokensRemaining,
    pricePerMillionTokens: l.pricePerMillionTokens,
    status: l.status,
    createdAt: l.createdAt.toISOString(),
    sellerName,
  }
}

export function toPurchaseListDTO(p: Purchase & { listing: { provider: string; model: string } }) {
  return {
    id: p.id,
    listingId: p.listingId,
    proxyKey: null as null, // never include in list view
    tokensPurchased: p.tokensPurchased,
    tokensRemaining: p.tokensRemaining,
    totalPaidCents: p.totalPaidCents,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    listing: p.listing,
  }
}

export function toPurchaseDetailDTO(p: Purchase & { listing: { provider: string; model: string } }) {
  return {
    ...toPurchaseListDTO(p),
    proxyKey: `ts-${p.proxyKey}`,
  }
}

export function toUsageLogDTO(u: UsageLog) {
  return {
    id: u.id,
    promptTokens: u.promptTokens,
    completionTokens: u.completionTokens,
    totalTokens: u.totalTokens,
    model: u.model,
    requestDurationMs: u.requestDurationMs,
    createdAt: u.createdAt.toISOString(),
  }
}
```

Update every API route to map through these. Never return Prisma objects directly.

### 5c. Redirect-if-signed-in on auth pages

`app/(auth)/login/page.tsx` and `app/(auth)/register/page.tsx` should check session and redirect to `/dashboard` if present.

Both are currently client components. Convert each to a thin server component wrapper:

```tsx
// app/(auth)/login/page.tsx (server)
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')
  return <LoginForm />
}
```

Move existing UI into `LoginForm.tsx` (client). Same for register.

### Verification

- Logged-in user visiting `/login` → redirect to `/dashboard`.
- No API response ever leaks `encryptedKey`, `iv`, `authTag`, `passwordHash`. Grep across the route handlers to confirm DTO usage.

---

## Phase 6 — UX & visual polish

### 6a. Landing nav fix

`app/page.tsx` links to `/dashboard/sell` and `/dashboard/buy` which 404 — routes are `/sell`, `/buy`. Update:
```tsx
<Link href="/sell" ...>Start Selling ...</Link>
<Link href="/buy" ...>Browse Marketplace</Link>
```

Add a top-right "Sign in" / "Get started" header for unauthenticated visitors (don't query session client-side — make a small server `<Header />` component).

### 6b. Loading skeletons

Replace bare `loading.tsx` files with shadcn-`Skeleton`-based mockups so loading feels intentional. Apply to:
- `app/(dashboard)/dashboard/loading.tsx` — 4 stat cards, 5 activity rows
- `app/(dashboard)/sell/loading.tsx` — 2 sections, table rows
- `app/(dashboard)/buy/loading.tsx` — filter bar + grid of 6 card skeletons
- `app/(dashboard)/keys/loading.tsx` — 3 purchase card skeletons
- `app/(dashboard)/settings/loading.tsx` — 3 section skeletons

Keep `app/loading.tsx` as a centered spinner (used for cold loads).

### 6c. Empty states

Verify each list has a styled empty state with the primary CTA:
- `/sell` when both vaults and listings empty: show a single "Add your first key" callout instead of two empty sections.
- `/buy` when no listings match filters: existing empty state is fine; add a "Clear filters" button that resets to defaults.
- `/keys` empty state already exists.
- Dashboard recent activity empty state already exists.

### 6d. Sidebar active state

`components/layout/Sidebar.tsx` — confirm it highlights based on `usePathname()`. Active item uses `bg-violet-600/10 text-violet-700 border-l-2 border-violet-500` (light theme — adjust for the actual zinc palette in use).

### 6e. Demo-mode banners

- `/buy` page top: amber-tinted alert: "Demo mode — payments use Stripe test cards (try 4242 4242 4242 4242). No real money is charged."
- `/sell` page top: amber-tinted alert: "Demo mode — listings don't earn real revenue yet. Automatic payouts arrive in v2."

Use the shadcn alert/callout pattern (or build a small inline one).

### 6f. Error boundary

`app/error.tsx` — confirm it has a "Try again" button (calls `reset()`) and a "Go home" link to `/`. Update copy to be friendly.

### Verification

- Click through every page logged-out, logged-in. No 404s. No console errors.
- Mobile (375px): hamburger drawer works on every dashboard page. Modals are full-height.
- Lighthouse on `/` and `/buy`: Performance > 85, Accessibility > 95.

---

## Phase 7 — Seed, scripts, README

### 7a. Seed update

`prisma/seed.ts`:
- Drop the Anthropic seller (`seller2`) and the Anthropic listing.
- Add 2 OpenAI listings under `seller1` or a new `seller2` (OpenAI key): `gpt-4-turbo` at $6/1M tokens 1M tokens, `gpt-3.5-turbo` at $0.30/1M, 10M tokens.
- Keep the buyer + the seeded `gpt-4o-mini` purchase + the 5 usage logs so `/keys` and dashboard render meaningfully on a fresh seed.

### 7b. package.json scripts

Add:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "test": "vitest run",
  "test:watch": "vitest",
  "seed": "tsx prisma/seed.ts",
  "postinstall": "prisma generate",
  "db:push": "prisma db push",
  "db:reset": "prisma migrate reset --force && npm run seed"
}
```

Add `prettier` as a dev dep; create a minimal `.prettierrc`:
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 7c. README rewrite

Replace `README.md` boilerplate with:

```markdown
# TokenSwap

A demo marketplace for AI API credits. Sellers list unused OpenAI credits; buyers purchase access through a secure proxy. The seller's real API key is never exposed.

> **Demo posture.** MVP runs in Stripe test mode. No real money. Stripe Connect Express payouts arrive in v2.

## Tech
Next.js 16 · React 19 · Tailwind v4 · shadcn/ui · Prisma · NextAuth v5 · Stripe · AES-256-GCM

## Quickstart

```powershell
git clone <repo>
cd tokenswap
cp .env.example .env.local
# generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# paste into .env.local; fill the Stripe keys (test mode) and NEXTAUTH_SECRET
npm install
npm run db:push
npm run seed
npm run dev
```

In another terminal:
```powershell
stripe listen --forward-to localhost:3000/api/webhook
```

Demo accounts: `seller1@demo.com` / `buyer@demo.com` — password `Demo1234!`.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

## Env vars
See `.env.example`. All required.

## Deployment
- Vercel for the Next app.
- Neon / Supabase / Railway for Postgres. Switch `prisma/schema.prisma` `datasource.provider` to `postgresql`. Run `npx prisma migrate deploy` on first deploy.
- Stripe webhook configured in dashboard pointing at `https://<domain>/api/webhook`. Webhook secret in env.

## Roadmap
See `plan.md`. V2 adds Stripe Connect Express payouts.
```

### Verification

- `npm run db:reset` works end-to-end on a fresh checkout (after `.env.local` is filled).
- All four new scripts succeed.

---

## Phase 8 — Tests

The minimum viable safety net for the proxy and payment paths.

### 8a. Test infra

Add as dev deps:
- `vitest`, `@vitest/ui`
- `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- `vitest-mock-extended` for typed mocks (or vanilla `vi.mock`)

Add `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

`test/setup.ts` — loads `.env.test` if present, sets fixed env vars so `lib/env.ts` doesn't throw.

For DB tests: spin a separate SQLite file at `prisma/test.db`, run `prisma db push` against it in `test/setup.ts`, truncate between tests via a helper.

### 8b. Critical-path tests

Aim for ~20 tests total. The ones that hurt if they break:

- `lib/crypto.test.ts`
  - encrypt/decrypt round-trip preserves plaintext
  - mutated authTag throws on decrypt
  - mutated ciphertext throws on decrypt
  - missing `ENCRYPTION_KEY` throws at module load

- `lib/proxy.test.ts`
  - rate limiter allows up to 60/minute, blocks 61st
  - rate limiter resets after window
  - rate limiter evicts oldest at MAX_ENTRIES

- `app/api/v1/chat/completions/route.test.ts`
  - missing Authorization header → 401 with OpenAI-shaped error
  - malformed Bearer prefix → 401
  - non-existent proxyKey → 401
  - depleted purchase → 402
  - oversize body → 413
  - successful call with mocked OpenAI → records UsageLog, decrements tokensRemaining atomically
  - concurrent calls against a near-depleted purchase → only one decrement succeeds
  - model lock: buyer-supplied `body.model` is overridden by listing's model before forward

- `app/api/webhook/route.test.ts`
  - missing signature → 400
  - invalid signature → 400
  - valid `checkout.session.completed` → creates Purchase and decrements listing
  - duplicate session id → no-op (idempotent)
  - listing paused between checkout and webhook → Purchase created with `status='pending_refund'`
  - unhandled event type → 200 with `{ received: true }`

- `app/api/checkout/route.test.ts`
  - unauthenticated → 401
  - non-existent listing → 400
  - amount < 100K → 400
  - amount > tokensRemaining → 400

- `app/api/vault/route.test.ts`
  - GET never returns `encryptedKey`, `iv`, `authTag`
  - DELETE blocks when active listing exists → 409

Mock Stripe with `vi.mock('@/lib/stripe', () => ({ stripe: { webhooks: { constructEvent: vi.fn() }, checkout: { sessions: { create: vi.fn() } } } }))`. Mock `fetch` for the upstream OpenAI call.

### 8c. CI

`.github/workflows/ci.yml`:

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: tokenswap
          POSTGRES_PASSWORD: tokenswap
          POSTGRES_DB: tokenswap
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U tokenswap"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://tokenswap:tokenswap@localhost:5432/tokenswap
      NEXTAUTH_SECRET: ci-secret-do-not-use
      NEXTAUTH_URL: http://localhost:3000
      ENCRYPTION_KEY: 0000000000000000000000000000000000000000000000000000000000000000
      STRIPE_SECRET_KEY: sk_test_ci
      STRIPE_WEBHOOK_SECRET: whsec_ci
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_ci
      NEXT_PUBLIC_APP_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx prisma db push
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

For the CI Postgres step, the schema needs to be Postgres-flavored — for MVP CI, accept the manual `provider = "postgresql"` flip or use a small `prisma/schema.ci.prisma` swapped in via a `prebuild` script. Pick the simpler: update `schema.prisma` to Postgres once migrations are in place (Phase 4a) and keep SQLite only as a developer convenience document.

### Verification

- `npm test` passes locally.
- CI green on push.

---

## Phase 9 — Observability & health

### 9a. Structured logger

New `lib/logger.ts`:

```ts
type Level = 'info' | 'warn' | 'error'

function log(level: Level, label: string, data?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    label,
    ...data,
  }
  if (process.env.NODE_ENV === 'production') {
    console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry))
  } else {
    console[level === 'error' ? 'error' : 'log'](`[${label}]`, data ?? '')
  }
}

export const logger = {
  info: (label: string, data?: Record<string, unknown>) => log('info', label, data),
  warn: (label: string, data?: Record<string, unknown>) => log('warn', label, data),
  error: (label: string, data?: Record<string, unknown>) => log('error', label, data),
}
```

Replace every `console.error('[LABEL]', error)` with `logger.error('LABEL', { error: String(error) })`. Never pass full request bodies, secrets, or PII.

### 9b. Health endpoint

`app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'reachable' })
  } catch (error) {
    return NextResponse.json({ ok: false, db: 'unreachable' }, { status: 503 })
  }
}
```

Add this path to `middleware.ts` matcher exclusion (it's not in the protected matcher already, so no change needed).

### 9c. Sentry (optional, skip if user prefers no third-party)

Defer. Document in `agent.md` parking lot.

### Verification

- `curl http://localhost:3000/api/health` → `{ ok: true, db: 'reachable' }`.
- In dev, structured `[LABEL]` logs in console. In prod (NODE_ENV=production), single-line JSON.

---

## Phase 10 — Pre-launch checklist

Run in order. Anything red blocks launch.

1. `npm run typecheck` — zero errors
2. `npm run lint` — zero errors
3. `npm run build` — passes
4. `npm test` — all green
5. `npm run db:reset` — fresh seed loads
6. Manual smoke test:
   - [ ] Register a new account → redirected to dashboard
   - [ ] Already-signed-in `/login` → redirects to dashboard
   - [ ] Add OpenAI key (real `sk-...`) → "Key added successfully"
   - [ ] Create listing → appears on `/buy`
   - [ ] Buy with another account → Stripe test card `4242 4242 4242 4242` → redirected back → proxy key visible in `/keys`
   - [ ] `stripe listen --forward-to localhost:3000/api/webhook` shows webhook hit, Purchase row created, listing tokens decremented
   - [ ] Replay the same webhook (`stripe events resend ...`) → no duplicate Purchase
   - [ ] `curl` the proxy with `Bearer ts-<key>` → real OpenAI response, UsageLog written, tokensRemaining decremented
   - [ ] Curl with wrong key → 401 with `{ error: { message, type: 'auth_error' } }`
   - [ ] Curl with `stream: true` → SSE response, UsageLog written on stream end
   - [ ] Pause a listing → disappears from `/buy`
   - [ ] Delete account with active buyer purchases → blocked with clear message
   - [ ] `/api/health` returns 200 with `db: 'reachable'`
7. Mobile smoke (Chrome devtools, 375px width): all five dashboard pages, both modals, the buy sheet
8. Lighthouse: `/` and `/buy` Performance ≥ 85, Accessibility ≥ 95
9. `git log --all -p | grep -iE 'sk-live|whsec_|sk_test_[A-Za-z0-9]{20,}' | head` returns nothing meaningful (no leaked secrets in history)
10. Demo banners visible on `/buy` and `/sell`
11. `agent.md` and `plan.md` reflect the final state (no stale "TODO" lines)

---

## Files that will change (summary by phase)

Phase 1:
- `app/api/vault/[id]/route.ts`, `app/api/listings/[id]/route.ts`, `app/api/purchases/[id]/route.ts`, `app/(dashboard)/keys/page.tsx` — async params/searchParams/cookies
- `app/api/webhook/route.ts` — drop Pages config, add `runtime = 'nodejs'`
- `lib/stripe.ts` — update `apiVersion`

Phase 2:
- `app/api/v1/chat/completions/route.ts` — atomic decrement, SSE buffering, OpenAI-only path, body cap, OpenAI-shaped errors, `runtime`/`dynamic` exports
- `lib/providers.ts` — drop Anthropic
- `app/api/vault/route.ts` — OpenAI-only verify
- `components/vault/AddKeyModal.tsx` — OpenAI-only providers
- `components/listings/ListingFilters.tsx` — drop Anthropic/Groq tabs
- `types/index.ts` — `Provider = 'openai'`
- `prisma/seed.ts` — Anthropic out, 2 OpenAI listings added

Phase 3:
- `prisma/schema.prisma` — `Purchase.stripeSessionId @unique`
- `app/api/webhook/route.ts` — idempotency, conditional listing decrement, `pending_refund`, more event coverage
- `app/api/checkout/route.ts` — race-window comment
- `components/purchases/PurchaseCard.tsx` — `pending_refund` banner

Phase 4:
- `lib/env.ts` (new), `lib/crypto.ts`, `lib/stripe.ts`, `lib/db.ts` — env validation
- `lib/proxy.ts` — consolidate rate limiter with eviction
- `app/api/user/route.ts` — block delete with active buyer purchases
- `docker-compose.yml` (new), `.env.example` (new)

Phase 5:
- `lib/auth.ts` — login-only `authorize()`
- `lib/serializers.ts` (new)
- Every API route — use serializers
- `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx` — server wrappers with redirect-if-signed-in (+ `LoginForm.tsx`, `RegisterForm.tsx` clients)

Phase 6:
- `app/page.tsx` — fix nav links, add Header
- `app/(dashboard)/*/loading.tsx` — real skeletons
- `app/(dashboard)/buy/page.tsx`, `app/(dashboard)/sell/page.tsx` — demo banners
- `components/layout/Sidebar.tsx` — verify active state
- `app/error.tsx` — copy

Phase 7:
- `prisma/seed.ts` — final shape
- `package.json` — scripts + prettier
- `.prettierrc` (new), `README.md` rewrite

Phase 8:
- `vitest.config.ts` (new), `test/setup.ts` (new), `test/**/*.test.ts` (new), `.github/workflows/ci.yml` (new)

Phase 9:
- `lib/logger.ts` (new), replace `console.error` callsites
- `app/api/health/route.ts` (new)

Files that already work and should not be rewritten:
- `lib/crypto.ts` encrypt/decrypt (keep — just add env validation)
- `lib/db.ts` (keep — just import env validator)
- `components/ui/*` (keep)
- `components/shared/*` (keep)
- `components/listings/{ListingCard,ListingGrid,ListingsTable,CreateListingModal}` (keep — small edits for provider scope)
- `components/vault/VaultList` (keep)
- `components/purchases/{UsageBar,KeysClient}` (keep)
- `components/layout/{MobileNav,Sidebar}` (keep — sidebar active-state check)
- `app/(dashboard)/layout.tsx` (keep)

---

## V2 — Stripe Connect Express (real payouts)

Separate workstream after MVP. Goal: real money, automatic seller payouts, platform takes 10% as `application_fee`. This section is a plan-of-plans — write a dedicated `plan-v2.md` when V2 starts.

### V2.0 — Posture switch

- Drop demo-mode banners from `/buy` and `/sell`.
- Add `STRIPE_MODE=live` env switch with two key sets:
  ```
  STRIPE_SECRET_KEY_TEST=sk_test_...
  STRIPE_SECRET_KEY_LIVE=sk_live_...
  STRIPE_WEBHOOK_SECRET_TEST=whsec_test_...
  STRIPE_WEBHOOK_SECRET_LIVE=whsec_live_...
  ```
- `lib/stripe.ts` picks the matching pair based on `STRIPE_MODE`.

### V2.1 — Connect onboarding

Schema additions:
```prisma
model User {
  // ...
  stripeConnectAccountId  String? @unique
  stripeConnectStatus     String  @default("none") // none | pending | active | restricted
  stripeConnectCapabilities Json? // mirror of capabilities
}

model Payout {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripePayoutId String  @unique
  amountCents Int
  currency    String
  status      String   // paid | failed | pending
  arrivalDate DateTime?
  createdAt   DateTime @default(now())
}
```

New routes:
- `POST /api/connect/onboard` — creates Express account if missing; returns `accountLinks.create` URL for KYC.
- `GET /api/connect/status` — retrieves account, returns `{ chargesEnabled, payoutsEnabled, detailsSubmitted }`, updates `stripeConnectStatus`.
- `POST /api/connect/dashboard` — returns `accounts.createLoginLink(...)` URL.

New UI:
- `/sell/onboarding` walkthrough — step 1: "Set up payouts" CTA → redirect to Stripe; step 2 (after Stripe redirect back): show capability status.
- `/sell` shows a status badge: "Onboarding required" / "Pending verification" / "Active".

### V2.2 — Gate listing creation on Connect status

`POST /api/listings` returns 402 with a clear error if `stripeConnectStatus !== 'active'`. UI surfaces the onboarding CTA.

For listings that exist from the MVP demo period: a one-time backfill. Two options — pick at V2 launch:
1. Auto-pause all existing listings until each seller onboards.
2. Grandfather — route their revenue to platform (their listings keep working but generate platform-only revenue).

Plan picks (2) for kindness to existing demo sellers; document the choice in the V2 release notes.

### V2.3 — Destination charges with application_fee

In `app/api/checkout/route.ts`:

```ts
const seller = await db.user.findFirst({
  where: { listings: { some: { id: listingId } } },
  select: { stripeConnectAccountId: true },
})
if (!seller?.stripeConnectAccountId) return ... // refuse

const stripeSession = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [/* ... */],
  payment_intent_data: {
    application_fee_amount: platformFeeCents,
    transfer_data: { destination: seller.stripeConnectAccountId },
  },
  // ...
})
```

Stripe routes funds: seller's Connect account gets `total - 10%`, platform takes 10%. Platform stays merchant of record.

### V2.4 — Webhook expansion

Subscribe to:
- `account.updated` → sync `stripeConnectStatus` and capabilities.
- `payout.paid`, `payout.failed`, `payout.created` → write `Payout` rows.
- `charge.refunded` → mark Purchase `refunded`, write reversal to ledger.

### V2.5 — Earnings UI

New `/sell/earnings` panel:
- Lifetime revenue (sum of `tokensSold * price * 0.9`)
- Stripe-reported balance (available, pending)
- Payout history table

### V2.6 — Compliance

- Terms of Service draft (platform = facilitator, sellers responsible for own taxes).
- Privacy policy.
- Stripe Tax integration (optional).
- 1099-K reporting via Stripe Connect handles itself above threshold.

### V2 estimate

~5–7 working days for a familiar engineer once V2 starts.

---

## Out of scope (parking lot, not in MVP, not in V2)

- Anthropic / Groq / OpenRouter / Mistral providers (with or without translation layer)
- Email notifications (purchase receipts, listing depleted)
- Marketplace search and review/rating
- Multi-instance rate limits (Upstash/Redis)
- Theme toggle, i18n
- Soft-delete with grace period
- API key rotation / per-listing key
- Admin dashboard
- Sentry / Datadog
- Auto-refund on `pending_refund` purchases (manual only at MVP)

# TokenSwap — Project Context

This file is the single source of truth a fresh Claude session should read first. It describes what's built, the conventions in use, and the decisions that bind execution. The phased work backlog lives in `plan.md`.

## What TokenSwap is

A two-sided marketplace where sellers list unused AI API credits and buyers pay through Stripe to receive a proxy API key. When the buyer hits `POST /api/v1/chat/completions` with `Authorization: Bearer ts-<proxyKey>`, the platform looks up the matching purchase, decrypts the seller's stored API key server-side, and forwards the request to OpenAI. The real key is never exposed to the buyer. The platform takes a 10% fee on each transaction.

## Launch posture (decision)

- **MVP launches as a demo in Stripe test mode.** No real money moves. Buyers use `4242 4242 4242 4242`. Sellers are not paid out at MVP. Banners on `/buy` and `/sell` make this explicit.
- **Real payouts are V2 work** via Stripe Connect Express. See the V2 section in `plan.md`. Out of scope for MVP.

## Provider scope (decision)

- **OpenAI only at MVP.** Anthropic, Groq, Mistral, OpenRouter are deferred. The schema's `provider` field stays a free-form string so re-adding providers later is a code change, not a migration.
- The proxy translates nothing — buyers send OpenAI-compatible requests and OpenAI responds.

## Tech stack

- **Framework**: Next.js 16 (App Router), TypeScript strict
- **React**: 19
- **Styling**: Tailwind v4 + shadcn/ui (style: `radix-nova`, base color: `neutral`, CSS variables)
- **Database**: Prisma 5, SQLite for local dev, Postgres for CI and prod (decision)
- **Auth**: NextAuth v5 beta (Credentials provider, JWT strategy)
- **Payments**: Stripe (test mode at MVP)
- **Encryption**: Node `crypto`, AES-256-GCM, 12-byte random IV, hex-encoded `ENCRYPTION_KEY`
- **Password hashing**: `bcryptjs`, rounds 12
- **Forms**: `react-hook-form` + `zod` + `@hookform/resolvers`
- **Toasts**: `sonner` via the shadcn wrapper at `components/ui/sonner.tsx`
- **Icons**: `lucide-react` only

## Current state (as of this writing)

Built and working:
- Landing page (`app/page.tsx`) — dark theme, purple accents
- Auth pages: `app/(auth)/login`, `app/(auth)/register`
- NextAuth v5 wired with Credentials, JWT, custom callbacks exposing `user.id`
- Dashboard layout with sidebar and mobile nav (`app/(dashboard)/layout.tsx`)
- Dashboard pages: `/dashboard`, `/sell`, `/buy`, `/keys`, `/settings` — all rendering real data
- API routes: register, vault (GET/POST/DELETE), listings (GET/POST/PATCH/DELETE), checkout, webhook, purchases (GET list + GET by id), usage, user (PATCH/DELETE), user/password
- Proxy endpoint at `app/api/v1/chat/completions/route.ts` (OpenAI + Anthropic branches; Anthropic to be removed)
- AES-256-GCM encrypt/decrypt in `lib/crypto.ts`
- Prisma singleton in `lib/db.ts`
- Stripe singleton in `lib/stripe.ts`
- Provider catalog in `lib/providers.ts`
- In-memory rate limiter helper in `lib/proxy.ts` (separate map in the proxy route)
- Seed script in `prisma/seed.ts` (3 demo users, 3 listings, 1 purchase, 5 usage logs)
- Middleware at `middleware.ts` redirects unauth users from `/dashboard`, `/sell`, `/buy`, `/keys`, `/settings`
- shadcn UI primitives: avatar, badge, button, card, dialog, dropdown-menu, input, progress, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, tooltip
- Domain components: `ListingCard`, `ListingGrid`, `ListingFilters`, `ListingsTable`, `CreateListingModal`, `AddKeyModal`, `VaultList`, `PurchaseCard`, `UsageBar`, `KeysClient`, `SettingsClient`, `Sidebar`, `MobileNav`, `CopyButton`, `ProviderBadge`, `StatCard`
- Toaster mounted globally in `app/layout.tsx`
- Global `error.tsx`, `not-found.tsx`, `loading.tsx`; per-route `loading.tsx` for buy/dashboard/keys/sell/settings

Known gaps (the production-readiness backlog) — full detail in `plan.md`:
- Next 16 async-API drift (`params`, `searchParams`, `cookies()` not awaited in 4 files)
- Proxy token accounting is not atomic — race condition under concurrent requests
- Webhook is not idempotent — Stripe retries can double-create purchases
- Webhook does not re-validate listing status before creating Purchase
- Anthropic provider in proxy is broken (wrong body shape, wrong usage parsing) — being removed
- Streaming SSE parser splits chunks naively — events that span chunks lose usage
- In-memory rate limiter (acceptable for single-instance MVP, documented)
- `ENCRYPTION_KEY` not validated at module-load
- `User.delete` cascades vaults — buyers' active proxy keys would break
- No tests, no CI, no structured logging, no health check
- Landing page links to `/dashboard/sell` and `/dashboard/buy` which 404 (real routes are `/sell`, `/buy`)
- Two register code paths (Credentials `mode: 'register'` and `/api/auth/register`)
- Stripe API version pinned to old date string

## File and folder layout

```
tokenswap/
├── agent.md                              ← this file
├── plan.md                               ← phased work backlog
├── README.md                             ← needs rewrite (currently CRA boilerplate)
├── middleware.ts                         ← exports NextAuth `auth` as middleware
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── components.json                       ← shadcn config
├── package.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── app/
│   ├── layout.tsx                        ← Toaster + TooltipProvider + metadata
│   ├── page.tsx                          ← landing
│   ├── globals.css                       ← Tailwind v4 + theme tokens
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── loading.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    ← sidebar + topbar + signOut server action
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts                ← getDashboardData (server action)
│   │   │   └── loading.tsx
│   │   ├── sell/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts                ← getSellerData
│   │   │   └── loading.tsx
│   │   ├── buy/
│   │   │   ├── page.tsx                  ← fetches /api/listings server-side
│   │   │   └── loading.tsx
│   │   ├── keys/
│   │   │   ├── page.tsx                  ← fetches /api/purchases with cookie
│   │   │   └── loading.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       └── loading.tsx
│   └── api/
│       ├── auth/
│       │   ├── [...nextauth]/route.ts    ← re-exports handlers from lib/auth
│       │   └── register/route.ts
│       ├── vault/
│       │   ├── route.ts                  ← GET (list), POST (verify + encrypt + store)
│       │   └── [id]/route.ts             ← DELETE (with active-listing guard)
│       ├── listings/
│       │   ├── route.ts                  ← GET (public, filtered), POST (auth)
│       │   └── [id]/route.ts             ← GET (public), PATCH (owner), DELETE (owner, soft)
│       ├── checkout/route.ts             ← POST (creates Stripe session)
│       ├── webhook/route.ts              ← POST (verifies signature, handles checkout.session.completed)
│       ├── purchases/
│       │   ├── route.ts                  ← GET list (proxyKey omitted)
│       │   └── [id]/route.ts             ← GET detail (proxyKey included)
│       ├── usage/route.ts                ← GET ?purchaseId=...
│       ├── user/
│       │   ├── route.ts                  ← PATCH (name), DELETE (with email confirm)
│       │   └── password/route.ts         ← POST (current → new)
│       └── v1/
│           └── chat/
│               └── completions/route.ts  ← THE PROXY
├── lib/
│   ├── auth.ts                           ← NextAuth config (Credentials, JWT)
│   ├── db.ts                             ← Prisma singleton
│   ├── crypto.ts                         ← AES-256-GCM encrypt/decrypt
│   ├── stripe.ts                         ← Stripe singleton
│   ├── providers.ts                      ← PROVIDERS catalog
│   ├── proxy.ts                          ← rate limit helper
│   └── utils.ts                          ← shadcn `cn`
├── components/
│   ├── ui/                               ← shadcn primitives
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── MobileNav.tsx
│   ├── listings/
│   │   ├── ListingCard.tsx
│   │   ├── ListingGrid.tsx
│   │   ├── ListingFilters.tsx
│   │   ├── ListingsTable.tsx
│   │   └── CreateListingModal.tsx
│   ├── vault/
│   │   ├── VaultList.tsx
│   │   └── AddKeyModal.tsx
│   ├── purchases/
│   │   ├── PurchaseCard.tsx
│   │   ├── UsageBar.tsx
│   │   └── KeysClient.tsx
│   ├── settings/
│   │   └── SettingsClient.tsx
│   └── shared/
│       ├── CopyButton.tsx
│       ├── ProviderBadge.tsx
│       └── StatCard.tsx
└── types/
    ├── index.ts                          ← Provider, ListingWithStats, PurchaseWithListing, VaultItem
    └── next-auth.d.ts                    ← session.user.id augmentation
```

## Prisma schema (current)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id               String        @id @default(cuid())
  email            String        @unique
  name             String?
  passwordHash     String
  stripeCustomerId String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  listings         Listing[]
  purchases        Purchase[]
  vaults           ApiKeyVault[]
}

model ApiKeyVault {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     String
  label        String
  encryptedKey String
  iv           String
  authTag      String
  isValid      Boolean   @default(true)
  createdAt    DateTime  @default(now())
  listings     Listing[]
}

model Listing {
  id                    String      @id @default(cuid())
  sellerId              String
  seller                User        @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  vaultId               String
  vault                 ApiKeyVault @relation(fields: [vaultId], references: [id])
  provider              String
  model                 String
  tokensForSale         Int
  tokensRemaining       Int
  pricePerMillionTokens Float
  status                String      @default("active") // active | paused | depleted | cancelled
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  purchases             Purchase[]
}

model Purchase {
  id               String     @id @default(cuid())
  buyerId          String
  buyer            User       @relation(fields: [buyerId], references: [id], onDelete: Cascade)
  listingId        String
  listing          Listing    @relation(fields: [listingId], references: [id])
  proxyKey         String     @unique @default(cuid())
  tokensPurchased  Int
  tokensRemaining  Int
  totalPaidCents   Int
  platformFeeCents Int
  stripeSessionId  String?    // → must become @unique in MVP for idempotency
  stripePaymentId  String?
  status           String     @default("pending") // pending | active | depleted | refunded
  createdAt        DateTime   @default(now())
  usageLogs        UsageLog[]
}

model UsageLog {
  id                String   @id @default(cuid())
  purchaseId        String
  purchase          Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  promptTokens      Int
  completionTokens  Int
  totalTokens       Int
  model             String
  requestDurationMs Int?
  createdAt         DateTime @default(now())
}
```

Schema deltas the MVP plan applies:
- `Purchase.stripeSessionId String? @unique` (webhook idempotency)
- Switch `datasource db.provider` to `postgresql` for prod / CI; keep SQLite for local

## Environment variables

Required, validated at boot:
- `DATABASE_URL` — `file:./dev.db` for dev, `postgres://...` for prod
- `NEXTAUTH_SECRET` — random 32+ bytes
- `NEXTAUTH_URL` — `http://localhost:3000` for dev, canonical URL for prod
- `ENCRYPTION_KEY` — 64-char hex string (32 bytes)
- `STRIPE_SECRET_KEY` — `sk_test_...` at MVP launch (test-mode posture)
- `STRIPE_WEBHOOK_SECRET` — from `stripe listen` locally, from Stripe dashboard in prod
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — `pk_test_...`
- `NEXT_PUBLIC_APP_URL` — base URL used to build success/cancel URLs

`.env.example` should be added at repo root listing all of the above with empty values.
`.env` and `.env.local` must remain gitignored.

To generate `ENCRYPTION_KEY`:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Security invariants — DO NOT BREAK

1. **Encrypted vault fields never leave the server.** No API response, log, or session ever includes `encryptedKey`, `iv`, or `authTag`. The proxy decrypts and uses the key in-memory, never logs it.
2. **`passwordHash` never leaves the server.**
3. **The buyer cannot choose the model** — the proxy overrides `body.model` with `purchase.listing.model` before forwarding.
4. **Stripe webhook signature is verified** with `stripe.webhooks.constructEvent` against the raw text body. Use `await request.text()`, never `request.json()`.
5. **Token accounting must be atomic** — `usageLog.create` and `purchase.update` decrement happen in a single `db.$transaction`. Concurrent requests cannot both succeed when only one purchase has tokens left (use conditional `updateMany` with a `tokensRemaining: { gte: ... }` guard).
6. **Webhook is idempotent** — duplicate `stripeSessionId` is a no-op.
7. **Ownership checks on every mutation** — listings, vaults, purchases, user. Cross-user access returns 404, never the resource.
8. **Errors never echo secrets.** `console.error('[LABEL]', error)` is fine for logging; never log request bodies, headers, or decrypted keys.
9. **Rate limit on the proxy** — 60 req/min per proxy key (in-memory map at MVP, documented limitation).

## API route pattern (use everywhere)

```ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // ...
    return NextResponse.json({ data })
  } catch (error) {
    console.error('[API_LABEL]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

Response shape: `{ data }` on success, `{ error: string }` on failure. Proxy is the exception — it follows OpenAI's `{ error: { message, type, code? } }` shape.

For dynamic routes in Next 16, params are async:
```ts
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // ...
}
```

## Conventions

- TypeScript strict mode, no `any`. Use `unknown` and narrow.
- Tailwind classes only. No inline styles.
- shadcn primitives over hand-rolled UI. Add via `npx shadcn@latest add <component>`.
- Forms use `react-hook-form` + `zod` resolver. Inline error messages in `text-rose-500`.
- Toasts: success `duration: 3000`, error `duration: 5000`. Always import `toast` from `sonner`.
- Server components fetch initial data via `actions.ts` server actions or direct DB; client components use `fetch` with error toasting.
- Use `console.error('[LABEL]', error)` for server-side errors. No `console.log`.
- Don't use the Prisma client directly in client components — go through API routes or server actions.

## Design system

- Marketing surfaces (`/`, `/login`, `/register`): `bg-[#0a0a0a]`, white text, purple-500 accents (`#8b5cf6`), purple-600 buttons.
- Dashboard surfaces: `bg-zinc-50`, `bg-white` cards, `text-zinc-900`, violet-600 accents.
- Border radius: `rounded-xl` (12px) for cards, `rounded-2xl` for hero panels, `rounded-full` for pills.
- Status colors: active = emerald, paused = amber, depleted = rose, cancelled/pending = zinc.
- Provider badges in `components/shared/ProviderBadge.tsx`.

## Stripe test cards

- Success: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
- Decline: `4000 0000 0000 0002`
- 3DS auth required: `4000 0025 0000 3155`

## Local development

```powershell
npm install
# generate ENCRYPTION_KEY (above), set in .env.local along with NEXTAUTH_SECRET, STRIPE_*
npm run db:push
npm run seed
npm run dev
# in a second terminal
stripe listen --forward-to localhost:3000/api/webhook
```

Demo credentials after seeding: `seller1@demo.com`, `seller2@demo.com`, `buyer@demo.com` — all with password `Demo1234!`.

## What NOT to do

- Don't use `any`. Use `unknown` and narrow.
- Don't inline-style anything. Tailwind classes only.
- Don't `console.log` request bodies, API keys, or PII.
- Don't create new UI components if a shadcn one exists.
- Don't return raw Prisma objects from API routes — map to DTOs that exclude secret fields.
- Don't add Anthropic (or any non-OpenAI provider) until V1.1.
- Don't move payouts off "test-mode demo" until V2 (Stripe Connect Express).
- Don't introduce features outside the `plan.md` backlog without writing them down first.

## How to use this with `plan.md`

`agent.md` is the **map**. `plan.md` is the **route**. A fresh Claude session should read this file first, then open `plan.md` and execute Phase 1, Phase 2, ... in order. Mark each phase complete by running its verification step before moving on.

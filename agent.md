# TokenSwap — Codex Project Context

## What this project is
TokenSwap is a two-sided marketplace where people sell unused AI API credits to buyers
via a secure server-side proxy. Sellers store their API key (encrypted AES-256-GCM),
create listings with a price and token quantity. Buyers purchase tokens via Stripe and
receive a proxy API key. When the buyer calls `/api/v1/chat/completions`, the platform
decrypts the seller's key server-side and forwards the request — the real key is never
exposed. The platform takes a 10% fee on every transaction.

## Current state of the codebase
- ✅ Landing page (`app/page.tsx`) — looks good, dark theme, purple accents
- ✅ Auth pages (`app/(auth)/login` and `app/(auth)/register`) — working
- ✅ NextAuth session working
- ✅ Prisma schema exists
- ✅ Basic routing structure in place
- ❌ Marketplace page (`/buy`) — 404, page.tsx missing or wrong folder
- ❌ Sell page (`/sell`) — 404, page.tsx missing or wrong folder
- ❌ Dashboard — not built
- ❌ API routes for listings, vault, checkout, webhook, proxy — not built
- ❌ Stripe integration — not connected
- ❌ Proxy engine — not built
- ❌ Key vault (encrypt/decrypt) — not built
- ❌ Usage tracking — not built

## Tech stack
- **Framework**: Next.js 14 App Router, TypeScript strict mode
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Prisma ORM + SQLite (dev) — keep Postgres-compatible syntax
- **Auth**: NextAuth.js v5 (beta) with Credentials provider
- **Payments**: Stripe (test mode)
- **Encryption**: Node.js built-in `crypto` module, AES-256-GCM
- **Password hashing**: bcryptjs

## Colour & design system
- Background: `#0a0a0a` (near black) on marketing pages
- Surface: `#111111` for cards on dark pages, `#ffffff` / `#f9fafb` for dashboard
- Primary accent: purple `#7c3aed` (violet-700) / `#8b5cf6` (violet-500)
- Text: white on dark, `#111827` on light
- Border: `rgba(255,255,255,0.08)` on dark cards, `#e5e7eb` on light
- Border radius: `0.75rem` (12px) for cards, `9999px` for pill buttons
- Fonts: system sans stack
- All icons: Lucide React only

## File/folder structure
```
tokenswap/
├── agent.md                          ← this file
├── app/
│   ├── layout.tsx                     ← root layout, dark bg
│   ├── page.tsx                       ← landing page ✅
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx             ✅
│   │   └── register/page.tsx          ✅
│   ├── (dashboard)/
│   │   ├── layout.tsx                 ← sidebar + topbar
│   │   ├── dashboard/page.tsx         ← overview
│   │   ├── sell/page.tsx              ← seller: manage keys + listings
│   │   ├── buy/page.tsx               ← marketplace browser
│   │   ├── keys/page.tsx              ← buyer: proxy keys + usage
│   │   └── settings/page.tsx          ← profile, billing
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── vault/
│       │   ├── route.ts               ← POST create, GET list
│       │   └── [id]/route.ts          ← DELETE
│       ├── listings/
│       │   ├── route.ts               ← GET browse, POST create
│       │   └── [id]/route.ts          ← GET, PATCH (pause/activate/delete)
│       ├── checkout/route.ts          ← POST: create Stripe session
│       ├── webhook/route.ts           ← POST: Stripe webhook
│       ├── purchases/route.ts         ← GET: buyer's purchases
│       ├── usage/route.ts             ← GET: usage logs for a purchase
│       └── v1/
│           └── chat/
│               └── completions/route.ts  ← THE PROXY ENDPOINT
├── lib/
│   ├── auth.ts                        ← NextAuth config
│   ├── db.ts                          ← Prisma client singleton
│   ├── crypto.ts                      ← encrypt/decrypt API keys
│   └── stripe.ts                      ← Stripe client singleton
├── components/
│   ├── ui/                            ← shadcn components (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── MobileNav.tsx
│   ├── listings/
│   │   ├── ListingCard.tsx
│   │   ├── ListingGrid.tsx
│   │   ├── CreateListingModal.tsx
│   │   └── ListingFilters.tsx
│   ├── vault/
│   │   ├── VaultList.tsx
│   │   └── AddKeyModal.tsx
│   ├── purchases/
│   │   ├── PurchaseCard.tsx
│   │   └── UsageBar.tsx
│   └── shared/
│       ├── CopyButton.tsx
│       ├── ProviderBadge.tsx
│       └── StatCard.tsx
├── hooks/
│   ├── useListings.ts
│   ├── useVault.ts
│   └── usePurchases.ts
├── types/
│   └── index.ts                       ← shared TypeScript types
└── prisma/
    ├── schema.prisma
    └── seed.ts
```

## Complete Prisma schema
```prisma
// prisma/schema.prisma
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
  provider     String    // "openai" | "anthropic" | "groq" | "mistral"
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
  pricePerMillionTokens Float       // in USD (e.g. 5.00 = $5/1M tokens)
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
  stripeSessionId  String?
  stripePaymentId  String?
  status           String     @default("pending") // pending | active | depleted | refunded
  createdAt        DateTime   @default(now())
  usageLogs        UsageLog[]
}

model UsageLog {
  id               String   @id @default(cuid())
  purchaseId       String
  purchase         Purchase @relation(fields: [purchaseId], references: [id], onDelete: Cascade)
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  model            String
  requestDurationMs Int?
  createdAt        DateTime @default(now())
}
```

## Environment variables (.env.local)
```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="generate-with: openssl rand -hex 32  (must be 64 hex chars = 32 bytes)"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Security rules — NEVER violate these
1. NEVER return `encryptedKey`, `iv`, or `authTag` in any API response
2. NEVER log a decrypted API key (not even in dev)
3. NEVER trust a proxyKey from a user without DB lookup
4. ALWAYS verify Stripe webhook signatures before processing
5. ALWAYS check that the authenticated user owns a resource before modifying it
6. The proxy endpoint (`/api/v1/*`) authenticates via proxyKey, NOT session
7. All other API routes MUST verify session and return 401 if unauthenticated
8. Rate limit proxy: 60 req/min per proxyKey using an in-memory Map

## Core lib implementations

### lib/crypto.ts
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes

export function encrypt(plaintext: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  }
}

export function decrypt(encryptedKey: string, iv: string, authTag: string): string {
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedKey, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
```

### lib/db.ts
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const db = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

### lib/stripe.ts
```typescript
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})
```

## Provider config
Supported providers with their models and proxy URLs:
```typescript
export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', inputPricePer1M: 5.0, outputPricePer1M: 15.0 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', inputPricePer1M: 0.15, outputPricePer1M: 0.60 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', inputPricePer1M: 10.0, outputPricePer1M: 30.0 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', inputPricePer1M: 0.50, outputPricePer1M: 1.50 },
    ],
    // Suggested sell price: ~60% of retail
    suggestedPricePer1M: { 'gpt-4o': 3.0, 'gpt-4o-mini': 0.09, 'gpt-4-turbo': 6.0, 'gpt-3.5-turbo': 0.30 },
    headerKey: 'Authorization', // "Bearer <key>"
  },
  anthropic: {
    name: 'Anthropic',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', inputPricePer1M: 3.0, outputPricePer1M: 15.0 },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', inputPricePer1M: 0.80, outputPricePer1M: 4.0 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', inputPricePer1M: 15.0, outputPricePer1M: 75.0 },
    ],
    suggestedPricePer1M: { 'claude-3-5-sonnet-20241022': 1.8, 'claude-3-5-haiku-20241022': 0.48, 'claude-3-opus-20240229': 9.0 },
  },
}
```

## API routes spec

### GET /api/listings
Public (no auth required). Query params:
- `provider` (optional): filter by provider
- `model` (optional): filter by model  
- `minTokens` (optional): minimum tokensRemaining
- `sort` (optional): "price_asc" | "price_desc" | "newest" | "mostTokens"
Returns: array of listings with seller first name (NOT email), never vault details.

### POST /api/listings
Auth required. Body: `{ vaultId, provider, model, tokensForSale, pricePerMillionTokens }`
Validates that vaultId belongs to authenticated user. Sets tokensRemaining = tokensForSale.

### PATCH /api/listings/[id]
Auth required. Must own listing. Body: `{ status }` (active | paused) or `{ pricePerMillionTokens }`.

### POST /api/vault
Auth required. Body: `{ provider, label, apiKey }`
1. Validate API key against provider (call provider's model list endpoint)
2. Encrypt with AES-256-GCM
3. Store ApiKeyVault (never return the encrypted fields)
Returns: `{ id, provider, label, isValid, createdAt }`

### DELETE /api/vault/[id]
Auth required. Must own vault. Check no active listings use it first.

### POST /api/checkout
Auth required. Body: `{ listingId, tokenAmount }`
1. Validate listing is active and has enough tokensRemaining
2. Calculate: subtotal = (tokenAmount / 1_000_000) * pricePerMillionTokens
3. Platform fee = subtotal * 0.10
4. Total = subtotal + fee
5. Create Stripe Checkout session
6. Return `{ url }`

### POST /api/webhook (raw body, not JSON)
Verify Stripe signature. On `checkout.session.completed`:
1. Extract metadata: listingId, buyerId, tokenAmount, totalCents, feeCents
2. Create Purchase with status "active", generate proxyKey
3. Decrement listing.tokensRemaining
4. If listing.tokensRemaining <= 0, set listing.status = "depleted"
Return 200 immediately, do DB work async.

### GET /api/purchases
Auth required. Returns buyer's purchases with listing info (provider, model).
NEVER return proxyKey in list — only return it in individual purchase detail.

### POST /api/v1/chat/completions (THE PROXY)
No session auth — uses proxyKey only.
Auth header format: `Bearer ts-<proxyKey>`
1. Extract proxyKey from auth header
2. Look up Purchase, include listing.vault (only the encrypted fields)
3. Verify purchase.status === 'active' and purchase.tokensRemaining > 0
4. Rate limit check (in-memory, 60/min per proxyKey)
5. Decrypt seller's API key
6. Force body.model = purchase.listing.model (security: buyer can't switch models)
7. Forward to provider with seller's real key
8. On success: log usage, decrement tokensRemaining in a transaction
9. If tokensRemaining hits 0, set purchase.status = "depleted"
10. Return provider's response unchanged
11. Support streaming: if body.stream === true, pipe ReadableStream through

## Dashboard pages spec

### /dashboard
Shows contextual content based on user's activity:
- If has listings: Seller widget — total earned (TODO: calculate from purchases), active listings count, tokens sold
- If has purchases: Buyer widget — total tokens remaining across all active purchases, total spent
- If new user: onboarding checklist — "Add your first API key → Create a listing → Make your first sale"
- Recent activity feed (last 5 usage logs or purchases)
- Quick action buttons

### /sell
Two-panel layout:
Left panel — "Your API Keys":
  - List of VaultList showing label, provider, isValid badge, created date
  - "Add API Key" button → AddKeyModal
  - Each item has delete button (with confirmation)
Right panel — "Your Listings":
  - List of user's listings with status badge (active=green, paused=yellow, depleted=gray)
  - Pause/Activate toggle switch
  - Edit price (inline edit)
  - Stats per listing: tokens sold, revenue, buyers
  - "Create Listing" button → CreateListingModal

AddKeyModal steps:
1. Select provider (OpenAI / Anthropic / Groq)
2. Enter label and paste API key
3. Show loading while validating key against provider API
4. Show success (green checkmark) or error with message
5. On success, save encrypted key, close modal, refresh list

CreateListingModal steps:
1. Select vault (shows label + provider badge for each)
2. Select model (filtered by provider)
3. Enter token quantity (min 100K, max 100M, show as "100K / 1M / 10M" chips for quick select)
4. Enter price — show suggested price chip, retail price for reference
5. Preview: "Buyers pay $X per 1M tokens (you save them Y% vs retail). You earn $Z after platform fee."
6. Confirm & create

### /buy (Marketplace)
Full marketplace browse experience:
- Sticky filter bar: Provider tabs (All / OpenAI / Anthropic), Model dropdown, Price range slider, Min tokens filter, Sort
- Search bar (search by model name)
- Listing grid (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each ListingCard shows:
  - Provider badge (colored pill)
  - Model name (large, bold)
  - "X tokens available" with visual bar
  - "$X.XX per 1M tokens" (very prominent)
  - "You save X% vs retail" badge (green)
  - "Buy Tokens" button
- Buy flow: click button → slide-in panel (not modal) with:
  - Token amount selector (slider + manual input + quick chips: 100K / 500K / 1M / 5M)
  - Price breakdown: subtotal + 10% platform fee + total
  - "Pay with Stripe" button → redirects to Stripe Checkout
- Empty state: "No listings match your filters" with clear filters button
- Loading skeleton cards while fetching

### /keys (My Proxy Keys)
Buyer's purchased access management:
- Each PurchaseCard shows:
  - Status badge (active / depleted / pending)
  - Provider + model info
  - Proxy key (masked: "ts-••••••••••••••••", reveal on hover/click, copy button)
  - Usage bar: tokensUsed / tokensPurchased with colour coding
  - "Top up" button if depleted or <10% remaining (links to buy same listing again)
  - Collapsible "Integration" section showing:
    ```
    # Python / OpenAI SDK
    from openai import OpenAI
    client = OpenAI(
        base_url="https://tokenswap.app/api/v1",
        api_key="ts-<your-proxy-key>"
    )
    
    # Node.js
    const openai = new OpenAI({
      baseURL: "https://tokenswap.app/api/v1",
      apiKey: "ts-<your-proxy-key>"
    })
    
    # curl
    curl https://tokenswap.app/api/v1/chat/completions \
      -H "Authorization: Bearer ts-<your-proxy-key>" \
      -d '{"messages": [{"role": "user", "content": "Hello"}]}'
    ```
  - Usage history table (last 20 calls, date/time, tokens used, model)
- Empty state: "No keys yet — browse the marketplace to buy tokens"

### /settings
- Profile: name, email (read-only), change password form
- Danger zone: delete account

## Common patterns to follow

### API route pattern
```typescript
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // ... db query
    return NextResponse.json(data)
  } catch (error) {
    console.error('[API_ERROR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Data fetching pattern (server components preferred)
Use async server components for initial page data, SWR/fetch for client-side mutations.

### Form pattern
Use react-hook-form + zod for all forms. Show inline validation errors.

### Toast notifications
Use shadcn/ui `useToast` for all success/error feedback. Import from `@/components/ui/use-toast`.

### Loading states
Every async action shows a loading spinner on the button and disables it during the request.

## Stripe test cards
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- Requires auth: 4000 0025 0000 3155

## Running locally
```bash
npm run dev          # start dev server
npx prisma studio    # browse database
npx prisma db push   # sync schema changes
npx prisma db seed   # seed demo data
stripe listen --forward-to localhost:3000/api/webhook  # forward Stripe webhooks
```

## What NOT to do
- Do not use `any` TypeScript type — always type things properly
- Do not inline styles — use Tailwind classes only
- Do not use `console.log` with sensitive data (keys, tokens, user PII)
- Do not create new UI components if a shadcn/ui component exists for it
- Do not use the Prisma client directly in page components — always go through API routes or server actions
- Do not use `fetch` in client components without error handling
- Do not store the decrypted API key anywhere (not session, not cache, not response)

## Priority build order
1. Fix 404s: create all missing page.tsx files with skeleton UI first
2. lib/ files: crypto.ts, db.ts, stripe.ts
3. Database: run prisma db push, create seed
4. API routes: vault → listings → checkout → webhook → purchases → proxy
5. Components: AddKeyModal → VaultList → CreateListingModal → ListingCard → PurchaseCard
6. Pages: /sell → /buy → /keys → /dashboard
7. Polish: loading states, empty states, error states, toast notifications
8. Proxy: streaming support, rate limiting, usage logging

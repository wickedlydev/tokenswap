
You are building the complete MVP for TokenSwap, a marketplace where sellers list unused
AI API credits and buyers purchase access through a secure proxy. The landing page and
auth are already built. Read agent.md in this project root first — it has the full
context, schema, security rules, and page specs.

Your goal: make the entire app production-ready and launchable. Work through phases in order.
Do not skip a phase. Run `npm run build` at the end — it must pass with zero TypeScript errors.

==============================================================================
PHASE 0 — VERIFY & FIX FOUNDATION
==============================================================================

0a. Read agent.md in full before writing a single line of code.

0b. Check the current folder structure by listing all files. Identify what exists vs
    what's missing. Report back the gap before proceeding.

0c. Ensure prisma/schema.prisma matches the schema in agent.md exactly. If it differs,
    update it and run: npx prisma db push

0d. Make sure all these packages are installed. Run npm install for any missing:
    - prisma @prisma/client
    - next-auth@beta @auth/prisma-adapter
    - bcryptjs @types/bcryptjs
    - stripe @stripe/stripe-js
    - react-hook-form @hookform/resolvers zod
    - lucide-react
    - class-variance-authority clsx tailwind-merge
    - @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-progress
    - @radix-ui/react-switch @radix-ui/react-slider @radix-ui/react-tabs
    - @radix-ui/react-tooltip @radix-ui/react-dropdown-menu

0e. Ensure shadcn/ui is initialised. If not: npx shadcn@latest init (choose slate, CSS variables yes).
    Then add all needed components:
    npx shadcn@latest add card button badge dialog input select progress switch
                             slider tabs tooltip dropdown-menu separator avatar
                             skeleton toast table

0f. Verify .env.local has all required variables listed in agent.md. If any are missing,
    print exactly what needs to be added and pause.

==============================================================================
PHASE 1 — CORE LIB FILES
==============================================================================

Create these files exactly as specified in agent.md:

1a. lib/db.ts — Prisma singleton
1b. lib/crypto.ts — AES-256-GCM encrypt/decrypt (exactly as in agent.md)
1c. lib/stripe.ts — Stripe singleton
1d. lib/auth.ts — NextAuth v5 config with Credentials provider:
    - Register flow: validate email format, check email not taken, hash password with
      bcryptjs (rounds: 12), create User record
    - Login flow: find user by email, bcrypt.compare, return session with id + email + name
    - Session strategy: "jwt"
    - Expose user.id in session (add callbacks: { jwt, session } to include id)

1e. lib/providers.ts — export the PROVIDERS config object from agent.md
    (provider names, models with prices, suggested sell prices, API URLs)

1f. types/index.ts — export all shared TypeScript types:
    ```typescript
    export type Provider = 'openai' | 'anthropic' | 'groq'
    export type ListingStatus = 'active' | 'paused' | 'depleted' | 'cancelled'
    export type PurchaseStatus = 'pending' | 'active' | 'depleted' | 'refunded'
    
    export interface ListingWithStats {
      id: string
      provider: Provider
      model: string
      tokensForSale: number
      tokensRemaining: number
      pricePerMillionTokens: number
      status: ListingStatus
      createdAt: string
      sellerName: string | null
      // Never include vault or encrypted key data
    }
    
    export interface PurchaseWithListing {
      id: string
      proxyKey: string  // only in detail view, masked in list
      tokensPurchased: number
      tokensRemaining: number
      totalPaidCents: number
      status: PurchaseStatus
      createdAt: string
      listing: {
        provider: Provider
        model: string
      }
    }
    
    export interface VaultItem {
      id: string
      provider: Provider
      label: string
      isValid: boolean
      createdAt: string
      // Never include encryptedKey, iv, authTag
    }
    ```

==============================================================================
PHASE 2 — API ROUTES
==============================================================================

Build each API route exactly per the spec in agent.md. Every route must:
- Handle errors with try/catch and return proper HTTP status codes
- Validate ownership before updates/deletes
- Never return sensitive fields (encryptedKey, iv, authTag, passwordHash)
- Return consistent JSON shape: { data } on success, { error: string } on failure

2a. app/api/auth/[...nextauth]/route.ts
    Export GET and POST from lib/auth.ts handler.

2b. app/api/vault/route.ts — GET (list user's vaults) + POST (add new key)
    POST implementation:
    1. Parse { provider, label, apiKey } from body
    2. Validate apiKey is not empty and looks like an API key
    3. Verify key against provider API:
       - OpenAI: GET https://api.openai.com/v1/models with Authorization: Bearer <key>
       - Anthropic: GET https://api.anthropic.com/v1/models with x-api-key: <key> and
         anthropic-version: 2023-06-01
       - If fetch fails or returns 401/403, return { error: 'Invalid API key' } status 400
    4. Encrypt key using lib/crypto.ts encrypt()
    5. Create ApiKeyVault record
    6. Return { id, provider, label, isValid: true, createdAt } — NEVER return encrypted fields

2c. app/api/vault/[id]/route.ts — DELETE
    Check vault belongs to session user. Check no active listings use this vault.
    If listings exist: return { error: 'Cannot delete vault with active listings' } status 409.

2d. app/api/listings/route.ts — GET (browse all active) + POST (create)
    GET: Public, no auth needed. Filter by query params. Return ListingWithStats[].
         Include sellerName (user.name ?? 'Anonymous'). Never include vault data.
    POST: Auth required. Validate vaultId belongs to user. Set tokensRemaining = tokensForSale.

2e. app/api/listings/[id]/route.ts — GET (single) + PATCH (update status/price) + DELETE
    PATCH: Allow { status: 'active' | 'paused' } or { pricePerMillionTokens: number }.
    DELETE: Soft delete — set status to 'cancelled'. Only if no active purchases.

2f. app/api/checkout/route.ts — POST
    Body: { listingId: string, tokenAmount: number }
    1. Auth check
    2. Fetch listing, verify active and tokenAmount <= tokensRemaining
    3. Validate tokenAmount >= 100_000 (minimum purchase)
    4. Calculate:
       const subtotalDollars = (tokenAmount / 1_000_000) * listing.pricePerMillionTokens
       const platformFeeDollars = subtotalDollars * 0.10
       const totalDollars = subtotalDollars + platformFeeDollars
       const totalCents = Math.round(totalDollars * 100)
    5. Create Stripe Checkout session:
       - payment_method_types: ['card']
       - mode: 'payment'
       - line_items with token quantity, unit price, nice description
       - metadata: { listingId, buyerId: session.user.id, tokenAmount, platformFeeCents }
       - success_url: `${APP_URL}/keys?success=true&session_id={CHECKOUT_SESSION_ID}`
       - cancel_url: `${APP_URL}/buy`
    6. Return { url: session.url }

2g. app/api/webhook/route.ts — POST (raw body)
    CRITICAL: Use `await request.text()` not `request.json()` to get raw body for signature check.
    ```typescript
    export const config = { api: { bodyParser: false } }  // if needed
    
    const sig = request.headers.get('stripe-signature')!
    const body = await request.text()
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch (err) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    ```
    Handle checkout.session.completed:
    1. Extract metadata
    2. Use db.$transaction to atomically:
       a. Create Purchase (status: 'active', tokensPurchased, tokensRemaining = tokenAmount)
       b. Decrement listing.tokensRemaining by tokenAmount
       c. If listing.tokensRemaining <= 0, set listing.status = 'depleted'
    Return NextResponse.json({ received: true }) immediately.

2h. app/api/purchases/route.ts — GET
    Auth required. Return buyer's purchases ordered by createdAt desc.
    In list view: mask proxyKey as null (don't send it). Include listing info.
    
    app/api/purchases/[id]/route.ts — GET single purchase with proxyKey revealed.
    Must verify purchase.buyerId === session.user.id.

2i. app/api/usage/route.ts — GET
    Query param: purchaseId. Verify user owns the purchase.
    Return last 50 UsageLogs for that purchase.

2j. app/api/v1/chat/completions/route.ts — THE PROXY ENGINE
    This is the most critical file. Implement it exactly:

    ```typescript
    import { NextRequest, NextResponse } from 'next/server'
    import { db } from '@/lib/db'
    import { decrypt } from '@/lib/crypto'

    // In-memory rate limiter: 60 req/min per proxyKey
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
      
      // 1. Extract proxy key
      const authHeader = request.headers.get('authorization') ?? ''
      const proxyKey = authHeader.startsWith('Bearer ts-')
        ? authHeader.slice('Bearer ts-'.length)
        : null

      if (!proxyKey) {
        return NextResponse.json(
          { error: { message: 'Missing or invalid Authorization header. Use: Bearer ts-<proxyKey>', type: 'auth_error' }},
          { status: 401 }
        )
      }

      // 2. Rate limit
      if (!checkRateLimit(proxyKey)) {
        return NextResponse.json(
          { error: { message: 'Rate limit exceeded. Max 60 requests/minute.', type: 'rate_limit_error' }},
          { status: 429 }
        )
      }

      // 3. Look up purchase
      const purchase = await db.purchase.findUnique({
        where: { proxyKey },
        include: {
          listing: {
            include: { vault: { select: { encryptedKey: true, iv: true, authTag: true, provider: true } } }
          }
        }
      })

      if (!purchase) {
        return NextResponse.json(
          { error: { message: 'Invalid proxy key', type: 'auth_error' }},
          { status: 401 }
        )
      }

      if (purchase.status !== 'active') {
        return NextResponse.json(
          { error: { message: `Proxy key is ${purchase.status}. Purchase more tokens to continue.`, type: 'quota_error' }},
          { status: 402 }
        )
      }

      if (purchase.tokensRemaining <= 0) {
        await db.purchase.update({ where: { id: purchase.id }, data: { status: 'depleted' } })
        return NextResponse.json(
          { error: { message: 'Token quota exhausted. Purchase more tokens.', type: 'quota_error' }},
          { status: 402 }
        )
      }

      // 4. Decrypt seller's real API key (NEVER log this)
      const { vault } = purchase.listing
      const realKey = decrypt(vault.encryptedKey, vault.iv, vault.authTag)

      // 5. Parse and sanitise request body
      let body: Record<string, unknown>
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ error: { message: 'Invalid JSON body' }}, { status: 400 })
      }

      // Force model to what the listing specifies (security: buyers can't switch models)
      body.model = purchase.listing.model

      const isStreaming = body.stream === true

      // 6. Build forward headers
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

      // 7. Forward to provider
      const providerUrl = provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.anthropic.com/v1/messages'

      const upstream = await fetch(providerUrl, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify(body),
      })

      // 8. Handle non-streaming response
      if (!isStreaming) {
        const data = await upstream.json()
        const duration = Date.now() - startTime

        if (upstream.ok && data.usage) {
          const promptTokens = data.usage.prompt_tokens ?? 0
          const completionTokens = data.usage.completion_tokens ?? 0
          const totalTokens = promptTokens + completionTokens

          // Atomic: log usage + decrement tokens
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

          // Check if depleted
          if (purchase.tokensRemaining - totalTokens <= 0) {
            await db.purchase.update({
              where: { id: purchase.id },
              data: { status: 'depleted' },
            })
          }
        }

        return NextResponse.json(data, { status: upstream.status })
      }

      // 9. Streaming response — pipe through, count tokens from final chunk
      const encoder = new TextEncoder()
      let promptTokens = 0
      let completionTokens = 0
      let usageLogged = false

      const stream = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          // Try to extract usage from streaming chunks (OpenAI sends it in last chunk)
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(line.slice(6))
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
          if (!usageLogged && (promptTokens + completionTokens) > 0) {
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
          'Connection': 'keep-alive',
        },
      })
    }
    ```

==============================================================================
PHASE 3 — DASHBOARD LAYOUT
==============================================================================

3a. app/(dashboard)/layout.tsx
    Create a layout with:
    - Sidebar (desktop) with nav links: Dashboard, Sell, Marketplace, My Keys, Settings
    - Mobile: hamburger menu with slide-out drawer
    - Topbar showing: TokenSwap logo on mobile, user name + avatar (initials), sign out button
    - Sidebar nav items use Lucide icons:
      - Dashboard: LayoutDashboard
      - Sell: TrendingUp
      - Marketplace: ShoppingBag
      - My Keys: Key
      - Settings: Settings
    - Active route gets purple highlight
    - Auth guard: if no session, redirect to /login
    - Sidebar footer: show user email + "Sign out" button

3b. Sidebar.tsx component:
    ```tsx
    'use client'
    import Link from 'next/link'
    import { usePathname } from 'next/navigation'
    const navItems = [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/sell', label: 'Sell', icon: TrendingUp },
      { href: '/buy', label: 'Marketplace', icon: ShoppingBag },
      { href: '/keys', label: 'My Keys', icon: Key },
      { href: '/settings', label: 'Settings', icon: Settings },
    ]
    ```
    Mark active item with bg-violet-600/10 text-violet-400 border-l-2 border-violet-500 styling.

==============================================================================
PHASE 4 — SELL PAGE
==============================================================================

4a. app/(dashboard)/sell/page.tsx — server component, fetches user's vaults + listings

4b. VaultList component (components/vault/VaultList.tsx):
    Show each vault as a row with:
    - Provider badge (colored: OpenAI=green, Anthropic=orange, Groq=blue)
    - Label text
    - "Valid" green badge or "Invalid" red badge based on isValid
    - Created date (relative: "2 days ago")
    - Delete button (trash icon) — confirm dialog before deleting
    Empty state: dashed border box "No API keys yet. Add your first key to start selling."

4c. AddKeyModal (components/vault/AddKeyModal.tsx):
    Three steps using shadcn Dialog:
    Step 1 — Select provider (card grid with provider name + description):
      - OpenAI: "GPT-4o, GPT-4o-mini and more"
      - Anthropic: "Claude 3.5 Sonnet, Haiku and more"
    Step 2 — Enter key:
      - Label input (e.g. "My main OpenAI key")
      - API key input (type="password" with show/hide toggle)
      - Security notice: shield icon + "Encrypted with AES-256-GCM. Never shared with buyers."
      - Validate button — POST to /api/vault
    Step 3 — Result:
      - Success: green checkmark animation, "Key added successfully!"
      - Error: red X, show error message from API
    Uses react-hook-form + zod for validation.

4d. CreateListingModal (components/listings/CreateListingModal.tsx):
    Multi-step wizard:
    
    Step 1 — Select vault:
      List user's valid vaults as selectable cards.
    
    Step 2 — Select model:
      Show model cards filtered by vault's provider. Each card shows:
      - Model name
      - Retail price (e.g. "Retail: $5.00/1M tokens")
      - Suggested sell price chip
    
    Step 3 — Set quantity & price:
      - Token quantity: quick chips [100K / 500K / 1M / 5M / 10M] + manual number input
      - Price per 1M tokens: number input with suggested price prefilled
      - Live preview box:
        ```
        Buyers pay:   $X.XX / 1M tokens
        vs retail:    $Y.YY / 1M tokens (Z% cheaper)
        Your earnings: $A.AA (after 10% platform fee)
        ```
    
    Step 4 — Review & confirm:
      Summary of all selections. "Create Listing" button → POST /api/listings.
    
    On success: close modal, show toast "Listing created!", refresh listings list.

4e. Listings management table on the sell page:
    Show as a table with columns:
    - Model (with provider badge)
    - Tokens remaining / total (progress bar inline)
    - Price / 1M tokens
    - Status (badge)
    - Active toggle (switch)
    - Actions dropdown (Edit price, Delete)
    Empty state: "No listings yet. Create your first listing to start earning."

==============================================================================
PHASE 5 — MARKETPLACE (BUY PAGE)
==============================================================================

5a. app/(dashboard)/buy/page.tsx
    Server component that fetches listings. Pass to client component for filtering.

5b. ListingFilters (components/listings/ListingFilters.tsx) — client component:
    Filter state: provider, model, maxPrice, minTokens, sort
    - Provider: tab group (All / OpenAI / Anthropic / Groq)
    - Sort: dropdown (Cheapest first / Most expensive / Most tokens / Newest)
    - All filters applied client-side to the listings array (no re-fetch needed)

5c. ListingCard (components/listings/ListingCard.tsx):
    Card design:
    - Top strip: provider badge (pill, colored) right-aligned + model name
    - Center: huge price display "$X.XX" with "/1M tokens" muted underneath
    - Savings badge: "X% cheaper than retail" in green
    - Token bar: "[████████░░] 800K of 1M tokens left"
    - Bottom: "Buy Tokens →" button (full width, purple)
    
    Hover state: card lifts slightly (shadow), button changes shade.
    
    "Buy Tokens" opens a slide-in sheet (shadcn Sheet component) from the right:
    - Listing details at top
    - Token slider: min 100K, max = listing.tokensRemaining, step 100K
    - Quick amount chips: 100K / 500K / 1M
    - Price breakdown:
      ```
      Tokens:         1,000,000
      Price:          $3.00
      Platform fee:   $0.30 (10%)
      ─────────────────────────
      Total:          $3.30
      ```
    - "Pay with Stripe" button → POST /api/checkout → window.location.href = result.url
    - Loading state on button while creating session

5d. Empty state and loading:
    - Loading: grid of 6 skeleton cards
    - Empty: illustration area + "No listings available" + "Be the first to sell" CTA

==============================================================================
PHASE 6 — MY KEYS PAGE
==============================================================================

6a. app/(dashboard)/keys/page.tsx
    Fetch purchases from /api/purchases. Check for ?success=true query param on load
    and show a success toast if present.

6b. PurchaseCard (components/purchases/PurchaseCard.tsx):
    Expandable card design:
    
    Collapsed header:
    - Status badge
    - Model name (e.g. "GPT-4o") with provider badge
    - Token progress bar: "234K / 1M tokens used"
    - Expand chevron button
    
    Expanded body (accordion-style):
    Tab 1 — Integration:
      Show proxy key (masked: "ts-••••••••••••" with eye icon to reveal, copy button).
      Code snippet tabs: Python / Node.js / curl
      Use shadcn Tabs + a <pre> block with syntax highlighting using inline styles.
      The code dynamically inserts the user's actual proxy key when revealed.
    
    Tab 2 — Usage history:
      Fetch from /api/usage?purchaseId=X when tab is opened.
      Table: Date | Prompt tokens | Completion tokens | Total | Duration
      Show total row at bottom.
    
    "Top up" button if status is depleted or tokensRemaining < 10% of tokensPurchased.
    This links back to the same listing on the buy page.

6c. UsageBar (components/purchases/UsageBar.tsx):
    Progress bar with animated fill.
    Colours: >50% = green, 20-50% = amber, <20% = red.
    Show exact numbers below: "234,521 used · 765,479 remaining"

==============================================================================
PHASE 7 — DASHBOARD HOME
==============================================================================

7a. app/(dashboard)/dashboard/page.tsx
    Fetch: user's listings, user's purchases, recent usage logs.
    
    Seller stats section (if user has listings):
      StatCard grid (2x2):
      - Total listings (active count)
      - Tokens listed (sum of tokensRemaining across active listings)
      - Total buyers (count of distinct purchases across listings)
      - Estimated earnings (sum of (tokensSold * price / 1M) * 0.9) — TODO placeholder
    
    Buyer stats section (if user has purchases):
      StatCard grid:
      - Active keys count
      - Total tokens remaining (sum across active purchases)
      - Total spent (sum of totalPaidCents / 100 formatted as $X.XX)
      - Tokens used (sum of usageLogs totalTokens)
    
    Onboarding checklist (if new user with no listings AND no purchases):
      Step 1: "Add an API key" [Go →]
      Step 2: "Create your first listing" [Go →]
      Step 3: "Share and earn" [Dimmed until step 1+2 done]
    
    Recent activity feed:
      Last 10 items: UsageLogs (formatted as "Used X tokens on [model]") + Purchases
      Show as a timeline list with timestamps.

7b. StatCard (components/shared/StatCard.tsx):
    Simple card: big number, label, optional trend arrow (up/down + %).

==============================================================================
PHASE 8 — SETTINGS PAGE
==============================================================================

8a. app/(dashboard)/settings/page.tsx
    Three sections:
    
    Profile section:
    - Name: editable text input with save button
    - Email: read-only (show with lock icon)
    - PATCH /api/user with { name } — create this route if needed
    
    Change password section:
    - Current password, new password, confirm password
    - POST /api/user/password
    - Validate: new password min 8 chars, matches confirm
    
    Danger zone:
    - Delete account button (red, requires typing email to confirm)

==============================================================================
PHASE 9 — POLISH & PRODUCTION READINESS
==============================================================================

9a. Global error handling:
    - Create app/error.tsx (Next.js error boundary)
    - Create app/not-found.tsx with "Page not found" + link to dashboard
    - All API routes return { error: string } (never throw unhandled)
    - Client-side fetch errors always show a toast

9b. Loading states:
    - Create app/loading.tsx (global loading — spinner centered)
    - Create loading.tsx inside each dashboard route folder
    - Every button that triggers async action: disable + show spinner during request
    - Use shadcn Skeleton for content loading states

9c. Toast system:
    Add <Toaster /> to app/layout.tsx (from shadcn/ui).
    Toast on success: green, 3 second duration
    Toast on error: red, 5 second duration, shows error message
    Toasts for: key added, listing created, listing paused/activated, purchase success,
                key copied, any API error

9d. Form validation (all forms use react-hook-form + zod):
    - Email: valid email format
    - Password: min 8 characters
    - API key: not empty, min 20 chars
    - Token amount: number, min 100000, max = listing.tokensRemaining
    - Price: number, min 0.01, max 1000
    Zod schema errors show inline under each field in red.

9e. Empty states — every list has a styled empty state:
    - Vaults: "No API keys yet" with AddKeyModal trigger
    - Listings: "No listings yet" with CreateListingModal trigger
    - Marketplace: "No listings available — check back soon"
    - Keys: "No proxy keys yet — browse the marketplace"
    - Usage: "No requests yet — start using your proxy key"

9f. Responsive design:
    - Sidebar hidden on mobile (hamburger menu → drawer)
    - Cards stack 1 column on mobile, 2 on tablet, 3 on desktop
    - Token slider works on touch devices
    - Modals full-screen on mobile

9g. Metadata:
    Add to app/layout.tsx:
    ```tsx
    export const metadata = {
      title: 'TokenSwap — Buy and sell AI API credits',
      description: 'The marketplace for unused AI API tokens. Buy credits at 50%+ off retail. Sell your surplus and earn money.',
    }
    ```

9h. Prisma seed file (prisma/seed.ts):
    Create demo data:
    - 2 seller users (seller1@demo.com, seller2@demo.com, password: Demo1234!)
    - 1 buyer user (buyer@demo.com, password: Demo1234!)
    - For sellers: create ApiKeyVault records with FAKE encrypted data
      (use encrypt('sk-fake-demo-key') to create plausible records)
    - 3 active listings:
      - GPT-4o: 2M tokens at $3.00/1M, seller1
      - GPT-4o mini: 5M tokens at $0.09/1M, seller1
      - Claude 3.5 Sonnet: 1M tokens at $1.80/1M, seller2
    - 1 demo purchase for buyer (status 'active') against gpt-4o-mini listing
    - 5 demo usage logs for that purchase
    Add to package.json: "prisma": { "seed": "ts-node prisma/seed.ts" }
    Also add ts-node and @types/node if needed.

9i. middleware.ts (Next.js middleware — in project root):
    ```typescript
    import { auth } from '@/lib/auth'
    export default auth
    export const config = {
      matcher: ['/dashboard/:path*', '/sell/:path*', '/buy/:path*', '/keys/:path*', '/settings/:path*']
    }
    ```
    This redirects unauthenticated users to /login automatically.

==============================================================================
PHASE 10 — FINAL CHECKS
==============================================================================

10a. Run: npx tsc --noEmit
     Fix ALL TypeScript errors before continuing.

10b. Run: npm run build
     Fix any build errors. Common issues:
     - "use client" missing on components that use hooks
     - Missing "use server" on server actions
     - Dynamic imports needed for components using browser APIs

10c. Run: npx prisma db push
     Verify schema is applied.

10d. Run: npx prisma db seed
     Verify seed data is created.

10e. Test manually:
     □ Register a new account
     □ Login / logout
     □ Add API key (use a real or fake key — fake will fail validation, that's expected)
     □ Create a listing (requires valid vault)
     □ Browse marketplace — listings appear
     □ Listing filter works (by provider)
     □ Buy flow → Stripe checkout (use test card 4242 4242 4242 4242)
     □ After purchase, proxy key appears in /keys
     □ Copy proxy key works
     □ Integration snippet shows correct key
     □ Proxy endpoint responds (test with curl):
       curl http://localhost:3000/api/v1/chat/completions \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer ts-<your-proxy-key>" \
         -d '{"messages": [{"role": "user", "content": "Say hello in 5 words"}]}'
     □ Invalid proxy key returns 401 with clear error
     □ All pages load on mobile (check browser devtools responsive mode)
     □ No console errors in browser

10f. Final: run stripe listen for webhook testing:
     stripe listen --forward-to localhost:3000/api/webhook
     Complete a test purchase and verify purchase is created in DB.

==============================================================================
IMPORTANT NOTES FOR CODEX
==============================================================================

- If you encounter an issue that requires a decision (e.g. which shadcn version, a
  schema conflict), make a sensible decision, implement it, and note it in a comment.
  Do not stop and ask — keep building.

- Build in the order: API routes first (testable with curl), then components, then pages.
  This way each layer is testable before building on top of it.

- The proxy endpoint is the most critical feature — make sure it works for both
  streaming and non-streaming before moving to UI polish.

- Use `console.error('[LABEL]', error)` for error logging. Never log request bodies
  that might contain API keys or user data.

- When building client components that call APIs, always handle the case where the
  API returns an error object. Show the error.message in a toast.

- The proxy key format in the Authorization header is: "Bearer ts-<uuid>"
  (note the "ts-" prefix — this distinguishes proxy keys from real API keys)


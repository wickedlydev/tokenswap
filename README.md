# TokenSwap

A marketplace where people can sell unused AI API credits to buyers via a secure proxy layer. The seller's real API key is never exposed to buyers. Buyers get a proxy API key that routes requests through the seller's account.

## How the Proxy Works

- **Key Encryption**: Seller API keys are encrypted with AES-256-GCM and stored securely. The decrypted key is never logged or returned in any API response.
- **Proxy Routing**: Buyers receive a `ts_` prefixed proxy key. Requests to `/api/v1/chat/completions` are authenticated via this proxy key, then forwarded to the real provider with the decrypted seller key.
- **Token Accounting**: Every request is logged, and token usage is deducted from the buyer's purchased balance. When tokens reach zero, the proxy key is automatically depleted.

## How to Run Locally

```bash
# Install dependencies
npm install

# Set up environment variables (copy .env.local and fill in values)
cp .env.local.example .env.local

# Push database schema
npx prisma db push

# Seed demo data
npm run seed

# Start dev server
npm run dev
```

## How to Test the Proxy

```bash
# OpenAI-compatible endpoint
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ts_YOUR_PROXY_KEY" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Environment Variables

| Variable | Description |
|----------|------------|
| `DATABASE_URL` | SQLite database URL (file:./dev.db) |
| `NEXTAUTH_SECRET` | Session encryption secret |
| `NEXTAUTH_URL` | Application URL |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Prisma ORM + SQLite
- NextAuth.js v5
- Stripe Payments
- AES-256-GCM Encryption

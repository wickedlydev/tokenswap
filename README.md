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

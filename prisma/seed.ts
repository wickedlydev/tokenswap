import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { encrypt } from '../lib/crypto'

const db = new PrismaClient()

async function main() {
  await db.usageLog.deleteMany()
  await db.purchase.deleteMany()
  await db.listing.deleteMany()
  await db.apiKeyVault.deleteMany()
  await db.user.deleteMany()

  const passwordHash = await bcrypt.hash('Demo1234!', 12)

  const seller1 = await db.user.create({
    data: { email: 'seller1@demo.com', name: 'Seller One', passwordHash },
  })
  const seller2 = await db.user.create({
    data: { email: 'seller2@demo.com', name: 'Seller Two', passwordHash },
  })
  const buyer = await db.user.create({
    data: { email: 'buyer@demo.com', name: 'Buyer', passwordHash },
  })

  const fakeOpenAI = encrypt('sk-fake-demo-key')
  const fakeAnthropic = encrypt('sk-fake-demo-key')

  const openAiVault = await db.apiKeyVault.create({
    data: {
      userId: seller1.id,
      provider: 'openai',
      label: 'Seller1 OpenAI Key',
      encryptedKey: fakeOpenAI.encryptedKey,
      iv: fakeOpenAI.iv,
      authTag: fakeOpenAI.authTag,
      isValid: true,
    },
  })

  const anthropicVault = await db.apiKeyVault.create({
    data: {
      userId: seller2.id,
      provider: 'anthropic',
      label: 'Seller2 Anthropic Key',
      encryptedKey: fakeAnthropic.encryptedKey,
      iv: fakeAnthropic.iv,
      authTag: fakeAnthropic.authTag,
      isValid: true,
    },
  })

  await db.listing.create({
    data: {
      sellerId: seller1.id,
      vaultId: openAiVault.id,
      provider: 'openai',
      model: 'gpt-4o',
      tokensForSale: 2_000_000,
      tokensRemaining: 2_000_000,
      pricePerMillionTokens: 3.0,
      status: 'active',
    },
  })

  const listingMini = await db.listing.create({
    data: {
      sellerId: seller1.id,
      vaultId: openAiVault.id,
      provider: 'openai',
      model: 'gpt-4o-mini',
      tokensForSale: 5_000_000,
      tokensRemaining: 5_000_000,
      pricePerMillionTokens: 0.09,
      status: 'active',
    },
  })

  await db.listing.create({
    data: {
      sellerId: seller2.id,
      vaultId: anthropicVault.id,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      tokensForSale: 1_000_000,
      tokensRemaining: 1_000_000,
      pricePerMillionTokens: 1.8,
      status: 'active',
    },
  })

  const tokensPurchased = 1_000_000
  const subtotal = (tokensPurchased / 1_000_000) * listingMini.pricePerMillionTokens
  const platformFeeCents = Math.round(subtotal * 0.1 * 100)
  const totalPaidCents = Math.round((subtotal + subtotal * 0.1) * 100)

  const purchase = await db.purchase.create({
    data: {
      buyerId: buyer.id,
      listingId: listingMini.id,
      tokensPurchased,
      tokensRemaining: 850_000,
      totalPaidCents,
      platformFeeCents,
      status: 'active',
    },
  })

  await db.listing.update({
    where: { id: listingMini.id },
    data: { tokensRemaining: listingMini.tokensRemaining - tokensPurchased },
  })

  const usageSeed = [50_000, 40_000, 30_000, 20_000, 10_000]
  for (const totalTokens of usageSeed) {
    await db.usageLog.create({
      data: {
        purchaseId: purchase.id,
        promptTokens: Math.floor(totalTokens * 0.6),
        completionTokens: Math.floor(totalTokens * 0.4),
        totalTokens,
        model: listingMini.model,
        requestDurationMs: 1200,
      },
    })
  }

  console.log('Seed complete')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

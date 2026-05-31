import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const ph = await bcrypt.hash("demo1234", 12);
  const s1 = await db.user.upsert({ where: { email: "seller1@demo.com" }, update: {}, create: { email: "seller1@demo.com", name: "Alice", passwordHash: ph } });
  const s2 = await db.user.upsert({ where: { email: "seller2@demo.com" }, update: {}, create: { email: "seller2@demo.com", name: "Bob", passwordHash: ph } });
  await db.user.upsert({ where: { email: "buyer@demo.com" }, update: {}, create: { email: "buyer@demo.com", name: "Charlie", passwordHash: ph } });
  await db.apiKeyVault.upsert({ where: { id: "vs1" }, update: {}, create: { id: "vs1", userId: s1.id, provider: "openai", label: "OpenAI", encryptedKey: "x", iv: "a1b2c3d4e5f6", authTag: "f1e2d3c4" } });
  await db.apiKeyVault.upsert({ where: { id: "vs2" }, update: {}, create: { id: "vs2", userId: s1.id, provider: "anthropic", label: "Anthropic", encryptedKey: "x", iv: "b1c2d3e4e5", authTag: "e1d2c3b4" } });
  await db.apiKeyVault.upsert({ where: { id: "vs3" }, update: {}, create: { id: "vs3", userId: s2.id, provider: "openai", label: "GPT-4", encryptedKey: "x", iv: "c1d2e3e4", authTag: "d1c2b3a4" } });
  await db.listing.upsert({ where: { id: "ls1" }, update: {}, create: { id: "ls1", sellerId: s1.id, vaultId: "vs1", provider: "openai", model: "gpt-4o", tokensForSale: 5000000, pricePerMillionTokens: 800, status: "active" } });
  await db.listing.upsert({ where: { id: "ls2" }, update: {}, create: { id: "ls2", sellerId: s1.id, vaultId: "vs2", provider: "anthropic", model: "claude-3-5-sonnet", tokensForSale: 10000000, pricePerMillionTokens: 500, status: "active" } });
  await db.listing.upsert({ where: { id: "ls3" }, update: {}, create: { id: "ls3", sellerId: s2.id, vaultId: "vs3", provider: "openai", model: "gpt-4o-mini", tokensForSale: 8000000, pricePerMillionTokens: 30, status: "active" } });
  console.log("Seed done");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());

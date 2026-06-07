import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const rawKey = process.env.ENCRYPTION_KEY
if (!rawKey || !/^[0-9a-f]{64}$/i.test(rawKey)) {
  throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
}
const KEY = Buffer.from(rawKey, 'hex')

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

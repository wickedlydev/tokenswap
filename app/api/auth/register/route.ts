import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  try {
    const { email, password, name } = (await request.json()) as {
      email?: string
      password?: string
      name?: string | null
    }

    if (!email || !password || !isValidEmail(email) || password.length < 8) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      data: { email, passwordHash, name: name || null },
    })

    return NextResponse.json({ data: { id: user.id, email: user.email } }, { status: 201 })
  } catch (error) {
    console.error('[AUTH_REGISTER]', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}

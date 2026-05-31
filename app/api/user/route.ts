import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name } = (await request.json()) as { name?: string }
    const trimmed = name?.trim()

    if (!trimmed) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data: { name: trimmed },
      select: { id: true, name: true, email: true },
    })

    return NextResponse.json({ data: user })
  } catch (error) {
    console.error('[USER_PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { confirmEmail } = (await request.json()) as { confirmEmail?: string }
    if (!confirmEmail || confirmEmail !== session.user.email) {
      return NextResponse.json({ error: 'Email confirmation does not match' }, { status: 400 })
    }

    await db.user.delete({ where: { id: session.user.id } })
    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    console.error('[USER_DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params

    const vault = await db.apiKeyVault.findUnique({ where: { id } })
    if (!vault || vault.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const activeListings = await db.listing.count({
      where: { vaultId: id, status: 'active' },
    })

    if (activeListings > 0) {
      return NextResponse.json(
        { error: 'Cannot delete vault with active listings' },
        { status: 409 }
      )
    }

    await db.apiKeyVault.delete({ where: { id } })
    return NextResponse.json({ data: { id } })
  } catch (error) {
    console.error('[VAULT_DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

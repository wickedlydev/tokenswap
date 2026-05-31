import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { SettingsClient } from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <SettingsClient
      name={session.user.name ?? ''}
      email={session.user.email ?? ''}
    />
  )
}

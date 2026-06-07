import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { RegisterForm } from './RegisterForm'

export default async function RegisterPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')
  return <RegisterForm />
}

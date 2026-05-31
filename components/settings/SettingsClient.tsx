'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ProfileFormValues = z.infer<typeof profileSchema>
type PasswordFormValues = z.infer<typeof passwordSchema>

type SettingsClientProps = {
  name: string
  email: string
}

export function SettingsClient({ name, email }: SettingsClientProps) {
  const router = useRouter()
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: name || '' },
  })

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function handleProfileSubmit(values: ProfileFormValues) {
    setProfileLoading(true)
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error || 'Failed to update profile', { duration: 5000 })
        return
      }
      toast.success('Profile updated', { duration: 3000 })
      router.refresh()
    } catch (error) {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setProfileLoading(false)
    }
  }

  async function handlePasswordSubmit(values: PasswordFormValues) {
    setPasswordLoading(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error || 'Failed to update password', { duration: 5000 })
        return
      }
      toast.success('Password updated', { duration: 3000 })
      passwordForm.reset()
    } catch (error) {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch('/api/user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        toast.error(data.error || 'Failed to delete account', { duration: 5000 })
        return
      }
      router.push('/register')
    } catch (error) {
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="mt-1 text-zinc-500">Manage your profile and security.</p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Profile</h2>
        <form className="mt-4 space-y-4" onSubmit={profileForm.handleSubmit(handleProfileSubmit)}>
          <div>
            <label className="text-sm font-medium text-zinc-700">Name</label>
            <Input className="mt-1" {...profileForm.register('name')} />
            {profileForm.formState.errors.name && (
              <p className="mt-1 text-xs text-rose-500">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Email</label>
            <div className="relative mt-1">
              <Input value={email} readOnly className="pr-10" />
              <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>
          </div>
          <Button type="submit" disabled={profileLoading}>
            {profileLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving
              </span>
            ) : (
              'Save changes'
            )}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Change password</h2>
        <form className="mt-4 space-y-4" onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}>
          <div>
            <label className="text-sm font-medium text-zinc-700">Current password</label>
            <Input type="password" className="mt-1" {...passwordForm.register('currentPassword')} />
            {passwordForm.formState.errors.currentPassword && (
              <p className="mt-1 text-xs text-rose-500">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">New password</label>
            <Input type="password" className="mt-1" {...passwordForm.register('newPassword')} />
            {passwordForm.formState.errors.newPassword && (
              <p className="mt-1 text-xs text-rose-500">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Confirm password</label>
            <Input type="password" className="mt-1" {...passwordForm.register('confirmPassword')} />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-500">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={passwordLoading}>
            {passwordLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Updating
              </span>
            ) : (
              'Update password'
            )}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
        <h2 className="text-lg font-semibold text-rose-700">Danger zone</h2>
        <p className="mt-2 text-sm text-rose-600">
          Delete your account and all associated data. This cannot be undone.
        </p>
        <div className="mt-4 space-y-3">
          <Input
            placeholder="Type your email to confirm"
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
          />
          <Button
            variant="destructive"
            disabled={confirmEmail !== email || deleting}
            onClick={handleDelete}
          >
            {deleting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
              </span>
            ) : (
              'Delete account'
            )}
          </Button>
        </div>
      </section>
    </div>
  )
}

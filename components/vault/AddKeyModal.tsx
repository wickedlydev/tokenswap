'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { CheckCircle2, Eye, EyeOff, Loader2, Shield, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const formSchema = z.object({
  label: z.string().min(2, 'Label is required'),
  apiKey: z.string().min(20, 'API key must be at least 20 characters'),
})

type FormValues = z.infer<typeof formSchema>

type AddKeyModalProps = {
  trigger: React.ReactNode
}

export function AddKeyModal({ trigger }: AddKeyModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { label: '', apiKey: '' },
  })

  function resetState() {
    setShowKey(false)
    setSubmitting(false)
    setResult(null)
    form.reset({ label: '', apiKey: '' })
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    setResult(null)

    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', ...values }),
      })

      const data = (await res.json()) as { error?: string }

      if (res.ok) {
        setResult({ status: 'success', message: 'Key added successfully!' })
        toast.success('Key added successfully', { duration: 3000 })
        router.refresh()
      } else {
        setResult({ status: 'error', message: data.error || 'Failed to add key' })
        toast.error(data.error || 'Failed to add key', { duration: 5000 })
      }
    } catch {
      setResult({ status: 'error', message: 'Network error. Please try again.' })
      toast.error('Network error. Please try again.', { duration: 5000 })
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetState()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none sm:h-auto sm:max-w-xl sm:rounded-xl">
        {!result && (
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Add your OpenAI key</h3>
              <p className="text-sm text-muted-foreground">
                We verify your API key before saving it to your vault.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Label</label>
              <Input
                {...form.register('label')}
                placeholder="My main OpenAI key"
                className="mt-1"
              />
              {form.formState.errors.label && (
                <p className="mt-1 text-xs text-rose-500">{form.formState.errors.label.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">API Key</label>
              <div className="relative mt-1">
                <Input
                  {...form.register('apiKey')}
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.apiKey && (
                <p className="mt-1 text-xs text-rose-500">{form.formState.errors.apiKey.message}</p>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs text-violet-700">
              <Shield className="h-4 w-4" />
              Encrypted with AES-256-GCM. Never shared with buyers.
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Validating...
                  </span>
                ) : (
                  'Validate key'
                )}
              </Button>
            </div>
          </form>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              {result.status === 'success' ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-pulse" />
              ) : (
                <XCircle className="h-12 w-12 text-rose-500" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {result.status === 'success' ? 'Success!' : 'Something went wrong'}
              </h3>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>
            <div className="flex justify-center gap-2">
              {result.status === 'error' && (
                <Button variant="outline" onClick={() => setResult(null)}>
                  Try again
                </Button>
              )}
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { CheckCircle2, Eye, EyeOff, Shield, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const providers = [
  { id: 'openai', name: 'OpenAI', description: 'GPT-4o, GPT-4o-mini and more' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude 3.5 Sonnet, Haiku and more' },
] as const

const formSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
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
  const [step, setStep] = useState(1)
  const [showKey, setShowKey] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { provider: 'openai', label: '', apiKey: '' },
  })

  const selectedProvider = form.watch('provider')

  function resetState() {
    setStep(1)
    setShowKey(false)
    setSubmitting(false)
    setResult(null)
    form.reset({ provider: 'openai', label: '', apiKey: '' })
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    setResult(null)

    const res = await fetch('/api/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    const data = (await res.json()) as { error?: string }

    if (res.ok) {
      setResult({ status: 'success', message: 'Key added successfully!' })
      router.refresh()
    } else {
      setResult({ status: 'error', message: data.error || 'Failed to add key' })
    }

    setSubmitting(false)
    setStep(3)
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
      <DialogContent className="max-w-xl">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Select provider</h3>
              <p className="text-sm text-zinc-500">
                Choose the API provider for the key you want to sell.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {providers.map((provider) => (
                <Card
                  key={provider.id}
                  className={`cursor-pointer border p-4 transition hover:border-violet-300 ${
                    selectedProvider === provider.id ? 'border-violet-400 bg-violet-50/40' : 'border-zinc-200'
                  }`}
                  onClick={() => form.setValue('provider', provider.id)}
                >
                  <p className="text-sm font-semibold text-zinc-900">{provider.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{provider.description}</p>
                </Card>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Continue</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Enter key details</h3>
              <p className="text-sm text-zinc-500">
                We verify your API key before saving it to your vault.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Label</label>
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
              <label className="text-sm font-medium text-zinc-700">API Key</label>
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400"
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
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Validating...' : 'Validate key'}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && result && (
          <div className="space-y-5 text-center">
            <div className="flex justify-center">
              {result.status === 'success' ? (
                <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-pulse" />
              ) : (
                <XCircle className="h-12 w-12 text-rose-500" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">
                {result.status === 'success' ? 'Success!' : 'Something went wrong'}
              </h3>
              <p className="text-sm text-zinc-500">{result.message}</p>
            </div>
            <div className="flex justify-center gap-2">
              {result.status === 'error' && (
                <Button variant="outline" onClick={() => setStep(2)}>
                  Try again
                </Button>
              )}
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

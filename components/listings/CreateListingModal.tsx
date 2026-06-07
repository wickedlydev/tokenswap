'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ChevronRight, Loader2 } from 'lucide-react'
import { PROVIDERS } from '@/lib/providers'
import { ProviderBadge } from '@/components/shared/ProviderBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const formSchema = z.object({
  vaultId: z.string().min(1, 'Select a vault'),
  model: z.string().min(1, 'Select a model'),
  tokensForSale: z.number().min(100_000, 'Minimum 100K tokens'),
  pricePerMillionTokens: z.number().min(0.01).max(1000),
})

type FormValues = z.infer<typeof formSchema>

type VaultOption = {
  id: string
  provider: string
  label: string
  isValid: boolean
}

type CreateListingModalProps = {
  trigger: React.ReactNode
  vaults: VaultOption[]
}

const quickTokenOptions = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function CreateListingModal({ trigger, vaults }: CreateListingModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const validVaults = useMemo(() => vaults.filter((vault) => vault.isValid), [vaults])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vaultId: validVaults[0]?.id ?? '',
      model: '',
      tokensForSale: 1_000_000,
      pricePerMillionTokens: 1.0,
    },
  })

  const selectedVault = validVaults.find((vault) => vault.id === form.watch('vaultId'))
  const providerKey = selectedVault?.provider as keyof typeof PROVIDERS | undefined
  const providerConfig = providerKey ? PROVIDERS[providerKey] : undefined
  const models: ReadonlyArray<{ id: string; name: string; inputPricePer1M: number; outputPricePer1M: number }> =
    providerConfig?.models ?? []
  const suggestedPrices: Record<string, number> = providerConfig?.suggestedPricePer1M ?? {}

  const selectedModel = models.find((model) => model.id === form.watch('model'))
  const tokensForSale = form.watch('tokensForSale')
  const pricePerMillionTokens = form.watch('pricePerMillionTokens')

  const retailPrice = selectedModel?.inputPricePer1M ?? 0
  const cheaperPercent = retailPrice > 0 ? Math.max(0, Math.round((1 - pricePerMillionTokens / retailPrice) * 100)) : 0
  const earnings = (tokensForSale / 1_000_000) * pricePerMillionTokens * 0.9

  function resetState() {
    setStep(1)
    setSubmitting(false)
    setError('')
    form.reset({
      vaultId: validVaults[0]?.id ?? '',
      model: '',
      tokensForSale: 1_000_000,
      pricePerMillionTokens: 1.0,
    })
  }

  async function handleCreate(values: FormValues) {
    if (!selectedVault) {
      setError('Select a vault before creating a listing')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaultId: values.vaultId,
          provider: selectedVault.provider,
          model: values.model,
          tokensForSale: values.tokensForSale,
          pricePerMillionTokens: values.pricePerMillionTokens,
        }),
      })

      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        setError(data.error || 'Failed to create listing')
        toast.error(data.error || 'Failed to create listing', { duration: 5000 })
        setSubmitting(false)
        return
      }

      toast.success('Listing created!', { duration: 3000 })
      router.refresh()
      setSubmitting(false)
      setOpen(false)
    } catch {
      setError('Network error. Please try again.')
      toast.error('Network error. Please try again.', { duration: 5000 })
      setSubmitting(false)
    }
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
      <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none sm:h-auto sm:max-w-3xl sm:rounded-xl">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Select a vault</h3>
              <p className="text-sm text-muted-foreground">Choose which API key powers this listing.</p>
            </div>
            {validVaults.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                Add a valid API key before creating a listing.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {validVaults.map((vault) => (
                  <Card
                    key={vault.id}
                    className={`cursor-pointer border p-4 transition hover:border-violet-300 ${
                      form.watch('vaultId') === vault.id
                        ? 'border-violet-400 bg-violet-50/40'
                        : 'border-border'
                    }`}
                    onClick={() => form.setValue('vaultId', vault.id)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{vault.label}</p>
                      <ProviderBadge provider={vault.provider} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{vault.provider.toUpperCase()} key</p>
                  </Card>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button disabled={validVaults.length === 0} onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Select a model</h3>
              <p className="text-sm text-muted-foreground">Pick the model buyers will use.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {models.map((model) => (
                <Card
                  key={model.id}
                  className={`cursor-pointer border p-4 transition hover:border-violet-300 ${
                    form.watch('model') === model.id
                      ? 'border-violet-400 bg-violet-50/40'
                      : 'border-border'
                  }`}
                  onClick={() => {
                    form.setValue('model', model.id)
                    const suggested = suggestedPrices[model.id]
                    if (suggested) form.setValue('pricePerMillionTokens', suggested)
                  }}
                >
                  <p className="text-sm font-semibold text-foreground">{model.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Retail: {formatCurrency(model.inputPricePer1M)}/1M</p>
                  {suggestedPrices[model.id] && (
                    <Badge className="mt-2 bg-violet-100 text-violet-700">
                      Suggested {formatCurrency(suggestedPrices[model.id])}/1M
                    </Badge>
                  )}
                </Card>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button disabled={!form.watch('model')} onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Set quantity and price</h3>
              <p className="text-sm text-muted-foreground">
                Choose how many tokens you want to sell and your price per 1M tokens.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Token quantity</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quickTokenOptions.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant={tokensForSale === amount ? 'default' : 'outline'}
                    onClick={() => form.setValue('tokensForSale', amount)}
                  >
                    {amount >= 1_000_000 ? `${amount / 1_000_000}M` : `${amount / 1000}K`}
                  </Button>
                ))}
              </div>
              <Input
                className="mt-3"
                type="number"
                min={100_000}
                step={10_000}
                value={tokensForSale}
                onChange={(event) => form.setValue('tokensForSale', Number(event.target.value))}
              />
              {form.formState.errors.tokensForSale && (
                <p className="mt-1 text-xs text-rose-500">
                  {form.formState.errors.tokensForSale.message}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Price per 1M tokens</p>
              <Input
                className="mt-2"
                type="number"
                min={0.01}
                step={0.01}
                value={pricePerMillionTokens}
                onChange={(event) => form.setValue('pricePerMillionTokens', Number(event.target.value))}
              />
              {form.formState.errors.pricePerMillionTokens && (
                <p className="mt-1 text-xs text-rose-500">
                  {form.formState.errors.pricePerMillionTokens.message}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-muted p-4 text-sm text-foreground">
              <div className="flex items-center justify-between">
                <span>Buyers pay:</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(pricePerMillionTokens)} / 1M tokens
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>vs retail:</span>
                <span>
                  {formatCurrency(retailPrice)} / 1M tokens ({cheaperPercent}% cheaper)
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span>Your earnings:</span>
                <span className="font-medium text-foreground">{formatCurrency(earnings)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => setStep(4)}>
                Review
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Review and confirm</h3>
              <p className="text-sm text-muted-foreground">Double-check your listing details.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-foreground">
              <div className="flex items-center justify-between">
                <span>Provider</span>
                <ProviderBadge provider={selectedVault?.provider ?? ''} />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Model</span>
                <span className="font-medium text-foreground">{selectedModel?.name}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Tokens for sale</span>
                <span className="font-medium text-foreground">{tokensForSale.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Price per 1M</span>
                <span className="font-medium text-foreground">
                  {formatCurrency(pricePerMillionTokens)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Earnings after fee</span>
                <span className="font-medium text-foreground">{formatCurrency(earnings)}</span>
              </div>
            </div>
            {error && <p className="text-sm text-rose-500">{error}</p>}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                disabled={submitting}
                onClick={form.handleSubmit(handleCreate)}
                className="gap-2"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                  </span>
                ) : (
                  <>
                    Create Listing <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

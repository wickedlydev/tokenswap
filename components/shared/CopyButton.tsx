'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

type CopyButtonProps = {
  value: string
  disabled?: boolean
  ariaLabel?: string
  successMessage?: string
}

export function CopyButton({
  value,
  disabled,
  ariaLabel = 'Copy to clipboard',
  successMessage = 'Copied to clipboard',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (disabled) return
    await navigator.clipboard.writeText(value)
    toast.success(successMessage, { duration: 3000 })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleCopy}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

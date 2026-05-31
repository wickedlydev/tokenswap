import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const providerStyles: Record<string, string> = {
  openai: 'bg-emerald-100 text-emerald-700',
  anthropic: 'bg-orange-100 text-orange-700',
  groq: 'bg-blue-100 text-blue-700',
}

const providerLabels: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
}

export function ProviderBadge({ provider, className }: { provider: string; className?: string }) {
  const style = providerStyles[provider] ?? 'bg-zinc-100 text-zinc-600'
  return (
    <Badge className={cn('border-0 px-2 py-0.5 text-xs font-medium', style, className)}>
      {providerLabels[provider] ?? provider}
    </Badge>
  )
}

'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type ListingFilterState = {
  provider: 'all' | 'openai' | 'anthropic' | 'groq'
  model: string
  maxPrice: string
  minTokens: string
  sort: 'price_asc' | 'price_desc' | 'mostTokens' | 'newest'
}

type ListingFiltersProps = {
  filters: ListingFilterState
  models: string[]
  onChange: (next: ListingFilterState) => void
}

export function ListingFilters({ filters, models, onChange }: ListingFiltersProps) {
  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={filters.provider}
          onValueChange={(value) =>
            onChange({
              ...filters,
              provider: value as ListingFilterState['provider'],
              model: 'all',
            })
          }
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="openai">OpenAI</TabsTrigger>
            <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
            <TabsTrigger value="groq">Groq</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={filters.sort}
          onValueChange={(value) =>
            onChange({ ...filters, sort: value as ListingFilterState['sort'] })
          }
        >
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price_asc">Cheapest first</SelectItem>
            <SelectItem value="price_desc">Most expensive</SelectItem>
            <SelectItem value="mostTokens">Most tokens</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          value={filters.model}
          onValueChange={(value) => onChange({ ...filters, model: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={0}
          step={0.01}
          placeholder="Max price (USD)"
          value={filters.maxPrice}
          onChange={(event) => onChange({ ...filters, maxPrice: event.target.value })}
        />

        <Input
          type="number"
          min={0}
          step={10000}
          placeholder="Min tokens"
          value={filters.minTokens}
          onChange={(event) => onChange({ ...filters, minTokens: event.target.value })}
        />
      </div>
    </div>
  )
}

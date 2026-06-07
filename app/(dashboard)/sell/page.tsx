import { Plus, Info } from 'lucide-react'
import { getSellerData } from './actions'
import { AddKeyModal } from '@/components/vault/AddKeyModal'
import { VaultList } from '@/components/vault/VaultList'
import { CreateListingModal } from '@/components/listings/CreateListingModal'
import { ListingsTable } from '@/components/listings/ListingsTable'
import { Button } from '@/components/ui/button'

export default async function SellPage() {
  const { vaults, listings } = await getSellerData()
  const validVaults = vaults.filter((vault) => vault.isValid)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Sell API Credits</h1>
        <p className="mt-1 text-muted-foreground">Manage your API keys and active listings</p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Demo mode</strong> — listings don&apos;t earn real revenue yet. Automatic
          payouts arrive in v2.
        </p>
      </div>

      {vaults.length === 0 && listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-foreground">Start selling in 60 seconds</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Add an OpenAI API key to your encrypted vault. We verify it before storing, and your key
            is never shared with buyers.
          </p>
          <AddKeyModal
            trigger={
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Add your first key
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Your API Keys</h2>
              <AddKeyModal
                trigger={
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Add API Key
                  </Button>
                }
              />
            </div>
            <VaultList vaults={vaults} />
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Your Listings</h2>
              <CreateListingModal
                vaults={vaults}
                trigger={
                  <Button className="gap-2" disabled={validVaults.length === 0}>
                    <Plus className="h-4 w-4" /> Create Listing
                  </Button>
                }
              />
            </div>
            <ListingsTable listings={listings} />
          </section>
        </>
      )}
    </div>
  )
}

import { Plus } from 'lucide-react'
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
        <h1 className="text-2xl font-bold text-zinc-900">Sell API Credits</h1>
        <p className="mt-1 text-zinc-500">Manage your API keys and active listings</p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Your API Keys</h2>
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
          <h2 className="text-lg font-semibold text-zinc-900">Your Listings</h2>
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
    </div>
  )
}

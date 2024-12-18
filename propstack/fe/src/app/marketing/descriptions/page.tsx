import { Header } from '@/components/layout/Header'
import { ListingForm } from '@/components/marketing/descriptions/ListingForm'
import { SavedListings } from '@/components/marketing/descriptions/SavedListings'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default function ListingDescriptionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Create New Section */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create New</h2>
          <ListingForm />
        </section>

        {/* Saved Listings Section */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Saved Listings</h2>
          <SavedListings />
        </section>
      </main>
    </div>
  )
} 
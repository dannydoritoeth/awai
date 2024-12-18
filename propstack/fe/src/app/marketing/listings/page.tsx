import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { ListingList } from '@/components/marketing/listings/ListingList'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default function ListingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
        <PageHeading 
          title="Property Listings"
          description="View and manage your property listings"
        />
        <ListingList />
      </main>
    </div>
  )
} 
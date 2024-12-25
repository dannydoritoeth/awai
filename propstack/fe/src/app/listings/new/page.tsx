import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { ListingWizard } from '@/components/listings/ListingWizard'

export default function NewListingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
        <PageHeading 
          title="Create New Listing"
          description="Create a new property listing"
          showBackButton
          backPath="/listings"
        />
        
        <ListingWizard />
      </main>
    </div>
  )
} 
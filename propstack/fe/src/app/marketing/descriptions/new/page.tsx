import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { PageHeading } from '@/components/layout/PageHeading'
import { ListingWizard } from '@/components/marketing/descriptions/ListingWizard'

export default function NewListingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition>
        <main className="container mx-auto px-4">
          <PageHeading 
            title="Create New Listing"
            description="Create a new property listing"
            showBackButton
            backPath="/marketing/descriptions"
          />
          
          <ListingWizard />
        </main>
      </PageTransition>
    </div>
  )
} 
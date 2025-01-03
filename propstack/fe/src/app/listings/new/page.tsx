import { PageHeading } from '@/components/layout/PageHeading'
import { ListingWizard } from '@/components/listings/ListingWizard'

export default function NewListingPage() {
  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Create New Listing"
        description="Create a new property listing"
        showBackButton
        backHref="/listings"
      />
      
      <ListingWizard />
    </div>
  )
} 
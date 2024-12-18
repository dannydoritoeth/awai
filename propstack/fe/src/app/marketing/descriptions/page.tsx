import { Header } from '@/components/layout/Header'
import { ListingForm } from '@/components/marketing/descriptions/ListingForm'
import { PageHeading } from '@/components/layout/PageHeading'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

// Config object for Next.js
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export default function ListingDescriptionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
        <PageHeading 
          title="Listing Description"
          description="Create compelling property descriptions with AI"
          showBackButton
        />
        <ErrorBoundary>
          <div className="space-y-4">
            <ListingForm />
          </div>
        </ErrorBoundary>
      </main>
    </div>
  )
} 
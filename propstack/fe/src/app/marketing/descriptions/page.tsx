import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { ListingForm } from '@/components/marketing/descriptions/ListingForm'

export const dynamic = 'force-static'

export default function ListingDescriptionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition showBackButton>
        <main className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Listing Description</h1>
              <p className="text-gray-600">Create compelling property descriptions with AI</p>
            </div>
            <button 
              onClick={() => {}} 
              className="text-blue-600 hover:text-blue-700"
            >
              Reset form
            </button>
          </div>
          
          <div className="space-y-4">
            <ListingForm />
          </div>
        </main>
      </PageTransition>
    </div>
  )
} 
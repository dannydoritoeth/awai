import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { PageHeading } from '@/components/layout/PageHeading'
import { ListingsTable } from '@/components/marketing/descriptions/ListingsTable'
import { PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default function ListingDescriptionsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition>
        <main className="container mx-auto px-4">
          <PageHeading 
            title="Listing Descriptions"
            description="Manage your property listings"
            showBackButton
            backPath="/marketing"
          />

          <div className="mb-4">
            <Link
              href="/marketing/descriptions/new"
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              New Listing
            </Link>
          </div>

          <ListingsTable />
        </main>
      </PageTransition>
    </div>
  )
} 
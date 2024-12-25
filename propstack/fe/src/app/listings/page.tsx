import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { ListingsTable } from '@/components/listings/ListingsTable'
import { PlusIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default function ListingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
        <PageHeading 
          title="Listings"
          description="Manage your property listings"
        />

        <div className="mb-4">
          <Link
            href="/listings/new"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            New Listing
          </Link>
        </div>

        <ListingsTable />
      </main>
    </div>
  )
} 
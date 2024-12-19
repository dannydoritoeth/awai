import Link from 'next/link'
import { Header } from '@/components/layout/Header'

export default function ListingNotFound() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-3xl font-semibold text-gray-900 mb-4">
            Listing Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            The listing you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <Link 
            href="/marketing/descriptions" 
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Back to Listings
          </Link>
        </div>
      </main>
    </div>
  )
} 
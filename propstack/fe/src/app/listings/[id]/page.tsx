"use client"

import { Header } from '@/components/layout/Header'
import { PageHeading } from '@/components/layout/PageHeading'
import { ListingDetail } from '@/components/listings/ListingDetail'
import Link from 'next/link'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { use } from 'react'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default function ListingDetailPage({ params }: PageProps) {
  const { id } = use(params)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4">
        <div className="mb-6">
          <Link
            href="/listings"
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back to Listings
          </Link>
        </div>
        
        <ListingDetail listingId={id} />
      </main>
    </div>
  )
} 
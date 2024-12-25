"use client"

import dynamic from 'next/dynamic'
import { Header } from '@/components/layout/Header'

// Import ListingDetail dynamically to disable SSR
const ListingDetail = dynamic(
  () => import('@/components/marketing/listings/ListingDetail').then(mod => mod.ListingDetail),
  { ssr: false }
)

export function ListingDetailPage({ id }: { id: string }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ListingDetail listingId={id} />
      </main>
    </div>
  )
} 
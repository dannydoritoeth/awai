"use client"

import { Header } from '@/components/layout/Header'
import { ListingForm } from '@/components/marketing/descriptions/ListingForm'
import { PageHeading } from '@/components/layout/PageHeading'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

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
        <div className="space-y-4">
          <ListingForm />
        </div>
      </main>
    </div>
  )
} 
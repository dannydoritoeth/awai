"use client"

import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { ListingForm } from '@/components/marketing/descriptions/ListingForm'
import { PageHeading } from '@/components/layout/PageHeading'

export const dynamic = 'force-dynamic'

export default function ListingDescriptionsPage() {
  const handleReset = () => {
    // Reset form logic here
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition>
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
      </PageTransition>
    </div>
  )
} 
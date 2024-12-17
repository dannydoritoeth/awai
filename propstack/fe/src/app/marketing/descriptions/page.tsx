"use client"

import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { ListingForm } from '@/components/marketing/descriptions/ListingForm'
import { DescriptionHeader } from '@/components/marketing/descriptions/DescriptionHeader'

export const dynamic = 'force-dynamic'

export default function ListingDescriptionsPage() {
  const handleReset = () => {
    // Reset form logic here
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition showBackButton>
        <main className="container mx-auto px-4">
          <DescriptionHeader onReset={handleReset} />
          <div className="space-y-4">
            <ListingForm />
          </div>
        </main>
      </PageTransition>
    </div>
  )
} 
"use client"

import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { ListingForm } from '@/components/marketing/descriptions/ListingForm'
import { PreviousListings } from '@/components/marketing/descriptions/PreviousListings'

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
            <div className="flex justify-center">
              <button
                className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition-colors w-full max-w-xs"
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  )
} 
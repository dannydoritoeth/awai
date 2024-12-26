"use client"

import React from 'react'

const titles = {
  'property-description': 'Property Description Generator',
  'listing-description': 'Listing Description Generator'
} as const

interface PageProps {
  params: {
    tool: string
  }
}

export default function MarketingToolPage({ params }: PageProps) {
  // Unwrap params using React.use()
  const unwrappedParams = React.use(params)
  const tool = unwrappedParams.tool

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <main className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {titles[tool as keyof typeof titles]}
        </h1>
        
        <div className="mt-8">
          {/* Add your new marketing tool content here */}
        </div>
      </main>
    </div>
  )
} 
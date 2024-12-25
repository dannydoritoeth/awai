"use client"

import { Header } from '@/components/layout/Header'

import { PageHeading } from '@/components/layout/PageHeading'
import { MarketingDashboard } from '@/components/marketing/descriptions/MarketingDashboard'

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
        <main className="container mx-auto px-4">
          <PageHeading 
            title="Marketing" 
            description="AI powered marketing tools for real estate"
            backHref="/"
            showBackButton
          />
          <MarketingDashboard />
        </main>
      
    </div>
  )
} 
"use client"

import { MarketingDashboard } from '@/components/marketing/MarketingDashboard'
import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition showBackButton>
        <main className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Marketing Tools</h1>
          <p className="text-gray-600 mb-8">Create and manage your property marketing content</p>
          <MarketingDashboard />
        </main>
      </PageTransition>
    </div>
  )
} 
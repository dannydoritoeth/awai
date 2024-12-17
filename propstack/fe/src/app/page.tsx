"use client"

import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { PageHeading } from '@/components/layout/PageHeading'

export const dynamic = 'force-dynamic'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition>
        <main className="container mx-auto px-4">
          <PageHeading 
            title="Dashboard" 
            description="Welcome to PropStack IO - your AI powered real estate marketing assistant"
          />
          <DashboardGrid />
        </main>
      </PageTransition>
    </div>
  )
}

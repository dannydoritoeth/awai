import { MarketingDashboard } from '@/components/marketing/descriptions/MarketingDashboard'
import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { PageHeading } from '@/components/layout/PageHeading'

export const dynamic = 'force-dynamic'

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition>
        <main className="container mx-auto px-4">
          <PageHeading 
            title="Marketing Tools" 
            description="Create and manage your property marketing content"
            showBackButton
          />
          <MarketingDashboard />
        </main>
      </PageTransition>
    </div>
  )
} 
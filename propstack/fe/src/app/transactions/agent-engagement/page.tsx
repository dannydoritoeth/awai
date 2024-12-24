"use client"

import { AgentEngagementWizard } from '@/components/transactions/agent-engagement/AgentEngagementWizard'
import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { PageHeading } from '@/components/layout/PageHeading'

export const dynamic = 'force-static'

export default function AgentEngagementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <PageTransition>
        <main className="container mx-auto px-4">
          <PageHeading 
            title="Agent Engagement" 
            description="Complete the agent engagement form"
            backHref="/transactions"
            showBackButton
          />
          <AgentEngagementWizard />
        </main>
      </PageTransition>
    </div>
  )
} 
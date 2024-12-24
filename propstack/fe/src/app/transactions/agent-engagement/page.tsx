"use client"

import { Header } from '@/components/layout/Header'
import { PageTransition } from '@/components/layout/PageTransition'
import { PageHeading } from '@/components/layout/PageHeading'
import { AgentEngagementWizard } from '@/components/transactions/agent-engagement/AgentEngagementWizard'
import { EngagementList } from '@/components/transactions/agent-engagement/EngagementList'

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
          <div className="space-y-8">
            <AgentEngagementWizard />
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Engagements</h2>
              <EngagementList />
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  )
} 
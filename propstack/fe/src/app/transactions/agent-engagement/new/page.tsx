import { PageHeading } from '@/components/layout/PageHeading'
import { AgentEngagementWizard } from '@/components/transactions/agent-engagement/AgentEngagementWizard'

export default function NewEngagementPage() {
  return (
    <div className="h-full p-8">
      <PageHeading 
        title="New Agent Engagement"
        description="Complete the agent engagement form"
        showBackButton
        backHref="/transactions/agent-engagement"
      />
      
      <AgentEngagementWizard />
    </div>
  )
} 
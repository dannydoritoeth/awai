import { PageHeading } from '@/components/layout/PageHeading'
import { AgentEngagementWizard } from '@/components/transactions/agent-engagement/AgentEngagementWizard'

export default function EditEngagementPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Edit Agent Engagement"
        description="Update the agent engagement details"
        showBackButton
        backHref={`/transactions/agent-engagement/${params.id}`}
      />
      
      <AgentEngagementWizard id={params.id} />
    </div>
  )
} 
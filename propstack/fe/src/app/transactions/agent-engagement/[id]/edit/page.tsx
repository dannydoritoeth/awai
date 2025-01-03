import { PageHeading } from '@/components/layout/PageHeading'
import { AgentEngagementWizard } from '@/components/transactions/agent-engagement/AgentEngagementWizard'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditEngagementPage({ params }: PageProps) {
  const { id } = await params
  
  return (
    <div className="h-full p-8">
      <PageHeading 
        title="Edit Agent Engagement"
        description="Update the agent engagement details"
        showBackButton
        backHref={`/transactions/agent-engagement/${id}`}
      />
      
      <AgentEngagementWizard id={id} />
    </div>
  )
} 
import { EngagementDetailPage } from '@/components/transactions/agent-engagement/EngagementDetailPage'

export default function AgentEngagementPage({ params }: { params: { id: string } }) {
  return (
    <div className="h-full">
      <EngagementDetailPage id={params.id} />
    </div>
  )
} 
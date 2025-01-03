import { EngagementDetailPage } from '@/components/transactions/agent-engagement/EngagementDetailPage'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AgentEngagementPage({ params }: PageProps) {
  const { id } = await params
  
  return (
    <div className="h-full">
      <EngagementDetailPage id={id} />
    </div>
  )
} 
import { Card } from '@/components/ui/Card'
import { ClipboardList } from 'lucide-react'

const features = [
  {
    title: 'Agent Engagement',
    subtitle: 'Complete Agent Engagement Process',
    icon: ClipboardList,
    color: 'bg-orange-50',
    href: '/transactions/agent-engagement',
  }
]

export function TransactionsGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((feature) => (
        <Card key={feature.title} {...feature} />
      ))}
    </div>
  )
} 
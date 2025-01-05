"use client"

import { useState } from 'react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import Link from 'next/link'

interface ListingAgentEngagementProps {
  agentEngagement: {
    id: string
    property_address: string
    seller_name: string
  }
}

export function ListingAgentEngagement({ agentEngagement }: ListingAgentEngagementProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <CollapsibleSection
      title="Agent Engagement"
      description="View linked agent engagement details"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="pt-2">
        <Link
          href={`/transactions/agent-engagement/${agentEngagement.id}`}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          View Agent Engagement
        </Link>
        <div className="mt-2 text-sm text-gray-600">
          <div>Property: {agentEngagement.property_address}</div>
          <div>Seller: {agentEngagement.seller_name}</div>
        </div>
      </div>
    </CollapsibleSection>
  )
} 
"use client"

import { 
  PencilSquareIcon, 
  PhotoIcon, 
  ShareIcon, 
  EnvelopeIcon 
} from '@heroicons/react/24/outline'
import { MarketingTool } from '../MarketingTool'

export function ListingsDashboard() {
  const tools = [
    {
      title: 'Listing Descriptions',
      description: 'Create professional property descriptions',
      icon: PencilSquareIcon,
      href: '/listings',  // Updated from /marketing/descriptions
      color: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    // ... other tools
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {tools.map((tool) => (
        <MarketingTool key={tool.title} {...tool} />
      ))}
    </div>
  )
} 
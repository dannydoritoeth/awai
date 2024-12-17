"use client"

import { 
  PencilSquareIcon, 
  PhotoIcon, 
  ShareIcon, 
  EnvelopeIcon 
} from '@heroicons/react/24/outline'
import { MarketingTool } from '../MarketingTool'
import { useMemo } from 'react'

export function MarketingDashboard() {
  const tools = useMemo(() => [
    {
      title: 'Listing Descriptions',
      description: 'Create professional property descriptions',
      icon: PencilSquareIcon,
      href: '/marketing/descriptions',
      color: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Enhance Images & Captions',
      description: 'Optimize property images and generate engaging captions',
      icon: PhotoIcon,
      href: '/marketing/images',
      color: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
      title: 'Create Social Media Content',
      description: 'Design ready-to-share posts for your social platforms',
      icon: ShareIcon,
      href: '/marketing/social',
      color: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      title: 'Email Campaign Generator',
      description: 'Create targeted email campaigns for your audience',
      icon: EnvelopeIcon,
      href: '/marketing/email',
      color: 'bg-yellow-50',
      iconColor: 'text-yellow-600'
    }
  ], [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {tools.map((tool) => (
        <MarketingTool key={tool.title} {...tool} />
      ))}
    </div>
  )
} 
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '../types'
import React from 'react'

interface ReviewFormProps {
  formData: AgentEngagementData
  onSubmit: () => void
  onBack: () => void
}

export function ReviewForm({ 
  formData, 
  onSubmit, 
  onBack 
}: ReviewFormProps) {
  const renderSection = (title: string, content: JSX.Element) => (
    <div className="space-y-2">
      <h3 className="font-medium text-gray-900">{title}</h3>
      <div className="bg-gray-50 rounded-lg p-4">
        {content}
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {/* Copy full JSX implementation */}
    </div>
  )
} 
"use client"

import { useState } from 'react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { XCircleIcon } from '@heroicons/react/24/solid'

interface EngagementChecklistPanelProps {
  engagementId: string
}

export function EngagementChecklistPanel({ engagementId }: EngagementChecklistPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  const checklistItems = [
    { id: 1, text: 'Complete Seller Details', completed: true },
    { id: 2, text: 'Property Information Added', completed: true },
    { id: 3, text: 'Title Search Completed', completed: false },
    { id: 4, text: 'Compliance Check Done', completed: false },
    { id: 5, text: 'Appraisal Prepared', completed: false },
    { id: 6, text: 'Synced with Agent Box', completed: false },
    { id: 7, text: 'Marketing Authorization', completed: true },
    { id: 8, text: 'Commission Agreement', completed: true },
  ]

  return (
    <CollapsibleSection
      title="Checklist"
      description="Track engagement progress"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="space-y-3 pt-2">
        {checklistItems.map((item) => (
          <div key={item.id} className="flex items-center space-x-3">
            {item.completed ? (
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-gray-300" />
            )}
            <span className={`text-sm ${item.completed ? 'text-gray-700' : 'text-gray-500'}`}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
} 
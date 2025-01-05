"use client"

import { useState } from 'react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { CheckIcon } from '@heroicons/react/24/solid'

interface ListingChecklistPanelProps {
  listingId: string
}

export function ListingChecklistPanel({ listingId }: ListingChecklistPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [checklist] = useState([
    { id: 'disclosure', label: 'Complete Disclosure Form', completed: true },
    { id: 'listing', label: 'Fill Listing Details', completed: true },
    { id: 'contract', label: 'Upload Contract Documents', completed: false },
    { id: 'tenant', label: 'Add Tenant Information', completed: false },
    { id: 'photos', label: 'Upload Property Photos', completed: true },
    { id: 'description', label: 'Write Property Description', completed: true },
    { id: 'social', label: 'Create Social Media Content', completed: false },
    { id: 'review', label: 'Final Review', completed: false },
  ])

  return (
    <CollapsibleSection
      title="Checklist"
      description="Track your listing progress"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="space-y-3 pt-2">
        {checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className={`
              w-5 h-5 rounded-full flex items-center justify-center
              ${item.completed 
                ? 'bg-green-100 text-green-600' 
                : 'bg-gray-100 text-gray-400'
              }
            `}>
              <CheckIcon className="w-3 h-3" />
            </div>
            <span className={`text-sm ${item.completed ? 'text-gray-900' : 'text-gray-500'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  )
} 
"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline'

interface EngagementWorkflowPanelProps {
  engagementId: string
}

export function EngagementWorkflowPanel({ engagementId }: EngagementWorkflowPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const router = useRouter()

  return (
    <CollapsibleSection
      title="Workflow"
      description="Manage engagement workflow"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="space-y-3 pt-2">
        <button
          onClick={() => router.push(`/transactions/agent-engagement/${engagementId}/appraisal`)}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <ClipboardDocumentIcon className="w-4 h-4 mr-2" />
          Prepare Appraisal
        </button>
      </div>
    </CollapsibleSection>
  )
} 
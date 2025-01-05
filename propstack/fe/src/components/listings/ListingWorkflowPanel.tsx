"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { 
  ClipboardDocumentCheckIcon, 
  HomeIcon, 
  DocumentTextIcon, 
  UsersIcon 
} from '@heroicons/react/24/outline'

interface ListingWorkflowPanelProps {
  listingId: string
}

export function ListingWorkflowPanel({ listingId }: ListingWorkflowPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const router = useRouter()

  const handleDisclosure = () => {
    router.push(`/listings/${listingId}/disclosure`)
  }

  const handleListing = () => {
    router.push(`/listings/${listingId}/listing-form`)
  }

  const handleContract = () => {
    router.push(`/listings/${listingId}/contract`)
  }

  const handleTenant = () => {
    router.push(`/listings/${listingId}/tenant`)
  }

  return (
    <CollapsibleSection
      title="Workflow"
      description="Manage your listing workflow"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="space-y-3 pt-2">
        <button
          onClick={handleDisclosure}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <ClipboardDocumentCheckIcon className="w-4 h-4 mr-2" />
          Disclosure
        </button>

        <button
          onClick={handleListing}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <HomeIcon className="w-4 h-4 mr-2" />
          Listing
        </button>

        <button
          onClick={handleContract}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <DocumentTextIcon className="w-4 h-4 mr-2" />
          Contract
        </button>

        <button
          onClick={handleTenant}
          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <UsersIcon className="w-4 h-4 mr-2" />
          Tenant
        </button>
      </div>
    </CollapsibleSection>
  )
} 
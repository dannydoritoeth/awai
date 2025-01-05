"use client"

import { useState } from 'react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import Link from 'next/link'

interface EngagementLinkedListingProps {
  listing: {
    id: string
    address: string
    status: string
  }
}

export function EngagementLinkedListing({ listing }: EngagementLinkedListingProps) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <CollapsibleSection
      title="Linked Listing"
      description="View linked property listing"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="pt-2">
        <Link
          href={`/listings/${listing.id}`}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          View Listing
        </Link>
        <div className="mt-2 text-sm text-gray-600">
          <div>Address: {listing.address}</div>
          <div>Status: {listing.status}</div>
        </div>
      </div>
    </CollapsibleSection>
  )
} 
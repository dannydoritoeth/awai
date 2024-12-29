import { 
  PencilIcon, 
  DocumentTextIcon,
  ShareIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { StatusBadge } from './StatusBadge'

interface ListingActionsProps {
  listingId: string
  statuses: {
    description: string
    socialMedia: string
    images: string
  }
}

export function ListingActions({ listingId, statuses }: ListingActionsProps) {
  const router = useRouter()

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Actions</h2>
        
        {/* Status Badges */}
        <div className="space-y-2 mb-6">
          <StatusBadge status={statuses.description} type="description" />
          <StatusBadge status={statuses.images} type="images" />
          <StatusBadge status={statuses.socialMedia} type="social" />
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => router.push(`/listings/${listingId}/edit`)}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <PencilIcon className="w-4 h-4 mr-2" />
            Edit Details
          </button>

          <button
            onClick={() => router.push(`/listings/${listingId}/description`)}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            Generate Description
          </button>

          <button
            onClick={() => router.push(`/listings/${listingId}/images`)}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <PhotoIcon className="w-4 h-4 mr-2" />
            Manage Images
          </button>

          <button
            onClick={() => router.push(`/listings/${listingId}/social-media`)}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ShareIcon className="w-4 h-4 mr-2" />
            Social Media
          </button>
        </div>
      </div>
    </div>
  )
} 
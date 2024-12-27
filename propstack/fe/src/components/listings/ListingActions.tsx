import { 
  PencilIcon, 
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ShareIcon,
  PhotoIcon
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { StatusBadge } from './StatusBadge'

interface ListingActionsProps {
  listingId: string
  statuses: {
    description: string
    titleCheck: string
    socialMedia: string
    images: string
  }
}

export function ListingActions({ listingId, statuses }: ListingActionsProps) {
  const router = useRouter()

  const handleGenerateDescription = () => {
    router.push(`/listings/${listingId}/description`)
  }

  const handleTitleCheck = async () => {
    // TODO: Implement title check
  }

  const handleSocialMedia = async () => {
    // TODO: Implement social media
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>
      
      <div className="space-y-4">
        {/* Status Overview */}
        <div className="space-y-2">
          <StatusBadge status={statuses.description || 'todo'} type="description" />
          <StatusBadge status={statuses.titleCheck || 'todo'} type="title" />
          <StatusBadge status={statuses.socialMedia || 'todo'} type="social" />
          <StatusBadge status={statuses.images || 'todo'} type="images" />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => router.push(`/listings/${listingId}/edit`)}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <PencilIcon className="w-4 h-4 mr-2" />
            Edit Listing
          </button>

          <button
            onClick={handleGenerateDescription}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            Listing Description
          </button>

          <button
            onClick={handleTitleCheck}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
            Title Check
          </button>

          <button
            onClick={handleSocialMedia}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <ShareIcon className="w-4 h-4 mr-2" />
            Social Media
          </button>

          <button
            onClick={() => router.push(`/listings/${listingId}/images`)}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <PhotoIcon className="w-4 h-4 mr-2" />
            Manage Images
          </button>
        </div>
      </div>
    </div>
  )
} 
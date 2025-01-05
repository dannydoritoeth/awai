"use client"

import { useRouter } from 'next/navigation'
import { 
  PencilIcon, 
  MagnifyingGlassIcon, 
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline'
import { EngagementStatus } from './types'

interface EngagementActionsProps {
  engagementId: string
  status: EngagementStatus
}

export function EngagementActions({ engagementId, status }: EngagementActionsProps) {
  const router = useRouter()

  const getStatusColor = (status: EngagementStatus) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'title_search': return 'bg-yellow-100 text-yellow-800'
      case 'review': return 'bg-purple-100 text-purple-800'
      case 'agreement': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleEdit = () => {
    router.push(`/transactions/agent-engagement/${engagementId}/edit`)
  }

  const handleTitleSearch = () => {
    router.push(`/transactions/agent-engagement/${engagementId}/title-search`)
  }

  const handleComplianceCheck = () => {
    router.push(`/transactions/agent-engagement/${engagementId}/compliance`)
  }

  const handleSyncToAgentBox = () => {
    router.push(`/transactions/agent-engagement/${engagementId}/sync-agentbox`)
  }

  const handleCreateListing = () => {
    router.push(`/transactions/agent-engagement/${engagementId}/create-listing`)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Actions</h2>
        
        {/* Status Badge */}
        <div className="mb-6">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
            ${getStatusColor(status)}`}
          >
            {status.replace('_', ' ')}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleEdit}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <PencilIcon className="w-4 h-4 mr-2" />
            Edit Details
          </button>

          {status === 'new' && (
            <>
              <button
                onClick={handleTitleSearch}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                Title Search
              </button>

              <button
                onClick={handleComplianceCheck}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ClipboardDocumentCheckIcon className="w-4 h-4 mr-2" />
                Compliance Check
              </button>

              <button
                onClick={handleSyncToAgentBox}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowPathIcon className="w-4 h-4 mr-2" />
                Sync to Agent Box
              </button>

              <button
                onClick={handleCreateListing}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PlusCircleIcon className="w-4 h-4 mr-2" />
                Create Listing
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
} 
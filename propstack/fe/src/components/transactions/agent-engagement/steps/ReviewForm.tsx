import { ChevronLeftIcon, ChevronRightIcon, Spinner } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'

interface ReviewFormProps {
  formData: AgentEngagementData
  onSubmit: () => void
  onBack: () => void
  onEditStep: (step: number) => void
  isEditing: boolean
  loading: boolean
}

export function ReviewForm({ 
  formData, 
  onBack, 
  onSubmit, 
  isEditing,
  loading 
}: ReviewFormProps) {
  const handleSubmitClick = (e: React.MouseEvent) => {
    e.preventDefault() // Prevent any form submission
    onSubmit()
  }

  return (
    <div className="p-6">
      {/* ... other content ... */}
      
      <div className="flex justify-between mt-8 pt-6 border-t">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmitClick}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ml-auto ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? (
            <>
              <Spinner className="w-4 h-4" />
              Saving...
            </>
          ) : (
            <>
              {isEditing ? 'Save Changes' : 'Submit'}
              {!isEditing && <ChevronRightIcon className="w-5 h-5" />}
            </>
          )}
        </button>
      </div>
    </div>
  )
} 
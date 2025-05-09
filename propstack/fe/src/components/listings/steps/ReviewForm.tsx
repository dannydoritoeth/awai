"use client"

import { ChevronLeftIcon } from '@heroicons/react/24/outline'

interface ReviewFormProps {
  data: any
  onSubmit: () => void
  onBack: () => void
  loading: boolean
  readOnly?: boolean
  mode?: 'create' | 'edit'
}

export function ReviewForm({ data, onSubmit, onBack, loading, readOnly = false, mode = 'create' }: ReviewFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  const getValue = (field: string) => {
    return data[field] || data[field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)]
  }

  const renderDetailRow = (label: string, value: string | number | null | undefined) => (
    <div className="py-2 flex justify-between">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-sm text-gray-900 text-right">{value || 'Not specified'}</dd>
    </div>
  )

  const renderHighlights = (highlights: string[] = [], type: 'property' | 'location') => (
    <div className="flex flex-wrap justify-end gap-1">
      {highlights.length > 0 ? (
        highlights.map((highlight) => (
          <span
            key={highlight}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs
              ${type === 'property' 
                ? 'bg-blue-50 text-blue-700'
                : 'bg-green-50 text-green-700'
              }`}
          >
            {highlight}
          </span>
        ))
      ) : (
        <span className="text-sm text-gray-500">None selected</span>
      )}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm">
      <div className="p-6 space-y-6">
        <h2 className="text-lg font-medium text-gray-900">Review Listing</h2>

        <div className="space-y-4">
          {/* Basic Details & Property Features combined */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <dl className="divide-y divide-gray-100">
              {/* Basic Details */}
              {renderDetailRow('Address', getValue('address'))}
              {renderDetailRow('Property Type', getValue('propertyType'))}
              {renderDetailRow('Listing Type', getValue('listingType'))}

              {/* Property Features */}
              {renderDetailRow('Price', getValue('price') ? `${getValue('currency')}${getValue('price')}` : null)}
              {renderDetailRow('Bedrooms', getValue('bedrooms'))}
              {renderDetailRow('Bathrooms', getValue('bathrooms'))}
              {renderDetailRow('Parking', getValue('parking'))}
              {renderDetailRow(
                'Interior Size',
                getValue('interiorSize') 
                  ? `${getValue('interiorSize')} ${getValue('interiorSizeUnit') || 'sqft'}`
                  : null
              )}
              {renderDetailRow(
                'Lot Size',
                getValue('lotSize')
                  ? `${getValue('lotSize')} ${getValue('lotSizeUnit') || 'sqft'}`
                  : null
              )}
            </dl>
          </div>

          {/* Highlights Section */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            {/* Property Highlights */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Property Highlights</h3>
              {renderHighlights(getValue('propertyHighlights') || getValue('property_highlights'), 'property')}
              {getValue('otherDetails') && (
                <p className="mt-2 text-sm text-gray-600">{getValue('otherDetails')}</p>
              )}
            </div>

            {/* Location Highlights */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Location Highlights</h3>
              {renderHighlights(getValue('locationHighlights') || getValue('location_highlights'), 'location')}
              {getValue('locationNotes') && (
                <p className="mt-2 text-sm text-gray-600">{getValue('locationNotes')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-6 py-2 rounded-md text-white 
              ${loading 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
            {loading 
              ? (mode === 'edit' ? 'Saving...' : 'Creating...') 
              : (mode === 'edit' ? 'Save Changes' : 'Create Listing')
            }
          </button>
        </div>
      )}
    </form>
  )
} 
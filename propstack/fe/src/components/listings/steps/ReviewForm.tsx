"use client"

import { ChevronLeftIcon } from '@heroicons/react/24/outline'

interface ReviewFormProps {
  data: any
  onSubmit: () => void
  onBack: () => void
  loading: boolean
}

export function ReviewForm({ data, onSubmit, onBack, loading }: ReviewFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
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
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <h2 className="text-lg font-medium text-gray-900">Review Listing</h2>

      <div className="space-y-4">
        {/* Basic Details & Property Features combined */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <dl className="divide-y divide-gray-100">
            {/* Basic Details */}
            {renderDetailRow('Address', data.address)}
            {renderDetailRow('Property Type', data.propertyType)}
            {renderDetailRow('Listing Type', data.listingType)}

            {/* Property Features */}
            {renderDetailRow('Price', data.price ? `${data.currency}${data.price}` : null)}
            {renderDetailRow('Bedrooms', data.bedrooms)}
            {renderDetailRow('Bathrooms', data.bathrooms)}
            {renderDetailRow('Parking', data.parking)}
            {renderDetailRow(
              'Interior Size', 
              data.interiorSize ? `${data.interiorSize} ${data.interiorSizeUnit}` : null
            )}
            {renderDetailRow(
              'Lot Size', 
              data.lotSize ? `${data.lotSize} ${data.lotSizeUnit}` : null
            )}
          </dl>
        </div>

        {/* Highlights Section */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          {/* Property Highlights */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Property Highlights</h3>
            {renderHighlights(data.propertyHighlights, 'property')}
            {data.otherDetails && (
              <p className="mt-2 text-sm text-gray-600">{data.otherDetails}</p>
            )}
          </div>

          {/* Location Highlights */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Location Highlights</h3>
            {renderHighlights(data.locationHighlights, 'location')}
            {data.locationNotes && (
              <p className="mt-2 text-sm text-gray-600">{data.locationNotes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
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
          {loading ? 'Creating...' : 'Create Listing'}
        </button>
      </div>
    </form>
  )
} 
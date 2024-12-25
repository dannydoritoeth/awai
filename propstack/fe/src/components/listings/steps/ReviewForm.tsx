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
    <div className="py-3 flex justify-between border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 text-right">{value || 'Not specified'}</dd>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Review Listing</h2>

      <div className="space-y-6">
        {/* Basic Details */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Details</h3>
          <dl className="space-y-1">
            {renderDetailRow('Address', data.address)}
            {renderDetailRow('Property Type', data.propertyType)}
            {renderDetailRow('Listing Type', data.listingType)}
          </dl>
        </div>

        {/* Property Features */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Property Features</h3>
          <dl className="space-y-1">
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

        {/* Property Highlights */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Property Highlights</h3>
          <dl className="space-y-1">
            <div className="py-3 flex justify-between border-b border-gray-100">
              <dt className="text-sm font-medium text-gray-500">Selected Features</dt>
              <dd className="text-sm text-gray-900 text-right max-w-[60%] flex flex-wrap justify-end gap-1">
                {data.highlights?.length > 0 ? (
                  data.highlights.filter(h => !h.includes('Near') && !h.includes('Close to')).map((highlight: string) => (
                    <span
                      key={highlight}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700"
                    >
                      {highlight}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500">None selected</span>
                )}
              </dd>
            </div>
            {data.otherDetails && renderDetailRow('Other Details', data.otherDetails)}
          </dl>
        </div>

        {/* Location Highlights */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Location Highlights</h3>
          <dl className="space-y-1">
            <div className="py-3 flex justify-between border-b border-gray-100">
              <dt className="text-sm font-medium text-gray-500">Nearby Features</dt>
              <dd className="text-sm text-gray-900 text-right max-w-[60%] flex flex-wrap justify-end gap-1">
                {data.highlights?.length > 0 ? (
                  data.highlights.filter(h => h.includes('Near') || h.includes('Close to')).map((highlight: string) => (
                    <span
                      key={highlight}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700"
                    >
                      {highlight}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500">None selected</span>
                )}
              </dd>
            </div>
            {data.locationNotes && renderDetailRow('Location Notes', data.locationNotes)}
          </dl>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
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
          className={`px-8 py-2 rounded-md text-white 
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
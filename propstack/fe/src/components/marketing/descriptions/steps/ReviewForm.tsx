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

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Review Details</h2>

      <div className="space-y-6">
        {/* Property Details Section */}
        <div>
          <h3 className="font-medium text-gray-900">Property Details</h3>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Address</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.address}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Property Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.propertyType}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Listing Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.listingType}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Price</dt>
              <dd className="mt-1 text-sm text-gray-900">${data.price}</dd>
            </div>
          </dl>
        </div>

        {/* Location Details Section */}
        <div>
          <h3 className="font-medium text-gray-900">Location</h3>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">Suburb</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.suburb}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">State</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.state}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Postcode</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.postcode}</dd>
            </div>
          </dl>
        </div>

        {/* Features Section */}
        <div>
          <h3 className="font-medium text-gray-900">Features</h3>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Bedrooms</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.bedrooms}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Bathrooms</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.bathrooms}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Parking</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.parking}</dd>
            </div>
          </dl>
        </div>

        {/* Description Section */}
        <div>
          <h3 className="font-medium text-gray-900">Description</h3>
          <div className="mt-2 text-sm text-gray-900">{data.description}</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
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
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Create Listing'}
        </button>
      </div>
    </form>
  )
} 
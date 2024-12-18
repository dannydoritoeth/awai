"use client"

import { ChevronLeftIcon } from '@heroicons/react/20/solid'

interface ListingPreviewProps {
  onBack: () => void
  formData: ListingFormData
  onNext: () => void
}

export function ListingPreview({ onBack, onNext, formData }: ListingPreviewProps) {
  const formatHighlights = (highlights: string[]) => {
    if (highlights.length === 0) return 'None selected'
    return highlights.join(', ')
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900">Listing Summary</h3>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <span className="font-medium">Address:</span>{' '}
            {formData.address}
            {formData.unitNumber && ` Unit ${formData.unitNumber}`}
          </div>
          <div>
            <span className="font-medium">Type:</span>{' '}
            {formData.propertyType.charAt(0).toUpperCase() + formData.propertyType.slice(1)} for {formData.listingType}
          </div>
          {formData.price && (
            <div>
              <span className="font-medium">Price:</span> ${formData.price}
            </div>
          )}
          {formData.bedrooms && (
            <div>
              <span className="font-medium">Bedrooms:</span> {formData.bedrooms}
            </div>
          )}
          {formData.bathrooms && (
            <div>
              <span className="font-medium">Bathrooms:</span> {formData.bathrooms}
            </div>
          )}
          {formData.parking && (
            <div>
              <span className="font-medium">Parking:</span> {formData.parking}
            </div>
          )}
          {formData.lotSize && (
            <div>
              <span className="font-medium">Lot Size:</span> {formData.lotSize} {formData.lotSizeUnit}
            </div>
          )}
          {formData.interiorSize && (
            <div>
              <span className="font-medium">Interior Size:</span> {formData.interiorSize} {formData.interiorSizeUnit}
            </div>
          )}
          <div>
            <span className="font-medium">Property Highlights:</span>{' '}
            {formatHighlights(formData.highlights)}
          </div>
          {formData.otherDetails && (
            <div>
              <span className="font-medium">Other Details:</span>{' '}
              {formData.otherDetails}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button onClick={onBack} className="px-6 py-2 text-gray-600 hover:text-gray-900 flex items-center gap-2">
          <ChevronLeftIcon className="w-5 h-5" />
          Back
        </button>
        <button onClick={onNext} className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition-colors">
          Next
        </button>
      </div>
    </div>
  )
} 
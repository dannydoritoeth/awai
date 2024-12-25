"use client"

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface HighlightsFormProps {
  data: any
  onUpdate: (data: any) => void
  onNext: () => void
  onBack: () => void
}

const PROPERTY_HIGHLIGHTS = [
  'Renovation potential',
  'Lot size',
  'Outdoor space',
  'Price point',
  'Quality of build',
  'Natural light',
  'Views',
  'Storage space',
  'Garage',
  'Modern features',
  'Character features',
  'Energy efficient',
  'Recently updated',
  'Low maintenance',
  'Privacy',
  'Security features'
] as const

const LOCATION_HIGHLIGHTS = [
  'Close to public transport',
  'Near schools',
  'Shopping nearby',
  'Quiet street',
  'Parks nearby',
  'Good neighborhood',
  'Close to CBD',
  'Beach access',
  'Mountain views',
  'Near restaurants',
  'Near entertainment'
] as const

export function HighlightsForm({ data, onUpdate, onNext, onBack }: HighlightsFormProps) {
  const handleHighlightToggle = (highlight: string) => {
    const newHighlights = data.highlights?.includes(highlight)
      ? data.highlights.filter((h: string) => h !== highlight)
      : [...(data.highlights || []), highlight]
    onUpdate({ highlights: newHighlights })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Highlights</h2>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Left Column - Property Highlights */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Property Highlights</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select the key features that make this property special.
              </p>
              
              <div className="flex flex-wrap gap-2">
                {PROPERTY_HIGHLIGHTS.map(highlight => (
                  <button
                    key={highlight}
                    type="button"
                    onClick={() => handleHighlightToggle(highlight)}
                    className={`px-3 py-1 rounded-full border ${
                      data.highlights?.includes(highlight)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    } text-sm`}
                  >
                    {highlight}
                  </button>
                ))}
              </div>
            </div>

            {/* Other Details Section */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Other details</h4>
              <textarea
                value={data.otherDetails || ''}
                onChange={(e) => onUpdate({ otherDetails: e.target.value })}
                placeholder="Example: Recent renovations, special features, etc."
                className="w-full h-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Location Highlights */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Location Highlights</h3>
              <p className="text-sm text-gray-600 mb-4">
                Select nearby amenities and location highlights.
              </p>
              
              <div className="flex flex-wrap gap-2">
                {LOCATION_HIGHLIGHTS.map(highlight => (
                  <button
                    key={highlight}
                    type="button"
                    onClick={() => handleHighlightToggle(highlight)}
                    className={`px-3 py-1 rounded-full border ${
                      data.highlights?.includes(highlight)
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    } text-sm`}
                  >
                    {highlight}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Notes */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Location notes</h4>
              <textarea
                value={data.locationNotes || ''}
                onChange={(e) => onUpdate({ locationNotes: e.target.value })}
                placeholder="Example: Close to schools, quiet neighborhood, etc."
                className="w-full h-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
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
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Next
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </form>
  )
} 
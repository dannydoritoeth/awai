"use client"

import { useState } from 'react'
import { ChevronLeftIcon } from '@heroicons/react/20/solid'

interface DescriptionGeneratorProps {
  onBack: () => void
  formData: ListingFormData
}

export function DescriptionGenerator({ onBack, formData }: DescriptionGeneratorProps) {
  const [language, setLanguage] = useState('English (Australia)')
  const [length, setLength] = useState('300')
  const [unit, setUnit] = useState('Words')

  const formatHighlights = (highlights: string[]) => {
    if (highlights.length === 0) return 'None selected'
    return highlights.join(', ')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Language and Length Settings */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Language</h3>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-2 w-full rounded-md border-gray-300"
          >
            <option>English (Australia)</option>
            <option>English (UK)</option>
            <option>English (US)</option>
            <option>English (Canada)</option>
            <option>French (Canada)</option>
          </select>

          <div className="mt-6 flex gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-medium text-gray-900">Ideal Length</h3>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  className="w-full rounded-md border-gray-300"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-32 rounded-md border-gray-300"
                >
                  <option>Words</option>
                  <option>Characters</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
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
            {/* ... rest of the summary fields ... */}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 text-gray-600 hover:text-gray-900 flex items-center gap-2"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back
        </button>
        <button
          className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Generate Description
        </button>
      </div>
    </div>
  )
} 
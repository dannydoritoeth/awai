"use client"

import { ChevronLeftIcon } from '@heroicons/react/20/solid'

interface PropertyDetailsFormProps {
  onBack: () => void
  formData: FormData
  onChange: (updates: Partial<FormData>) => void
}

export function PropertyDetailsForm({ onBack, formData, onChange }: PropertyDetailsFormProps) {
  const handleHighlightToggle = (highlight: string) => {
    const newHighlights = formData.highlights.includes(highlight)
      ? formData.highlights.filter(h => h !== highlight)
      : [...formData.highlights, highlight]
    onChange({ highlights: newHighlights })
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        {/* Left Column - Property Details */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Property Details</h3>
          <form className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700">$</label>
              <input
                type="text"
                value={formData.price || ''}
                onChange={(e) => onChange({ price: e.target.value })}
                placeholder="Price (optional)"
                className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Bedrooms</label>
              <input
                type="number"
                value={formData.bedrooms || ''}
                onChange={(e) => onChange({ bedrooms: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Bathrooms</label>
              <input
                type="number"
                value={formData.bathrooms || ''}
                onChange={(e) => onChange({ bathrooms: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Parking (optional)</label>
              <input
                type="text"
                value={formData.parking || ''}
                onChange={(e) => onChange({ parking: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Lot Size (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.lotSize || ''}
                  onChange={(e) => onChange({ lotSize: e.target.value })}
                  className="flex-1 rounded-md border-gray-300 shadow-sm text-gray-900"
                />
                <select
                  value={formData.lotSizeUnit || 'sqft'}
                  onChange={(e) => onChange({ lotSizeUnit: e.target.value as 'sqft' | 'acres' })}
                  className="w-24 rounded-md border-gray-300 shadow-sm text-gray-900"
                >
                  <option>Sq Feet</option>
                  <option>Acres</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700">Interior size (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.interiorSize || ''}
                  onChange={(e) => onChange({ interiorSize: e.target.value })}
                  className="flex-1 rounded-md border-gray-300 shadow-sm text-gray-900"
                />
                <select
                  value={formData.interiorSizeUnit || 'sqft'}
                  onChange={(e) => onChange({ interiorSizeUnit: e.target.value as 'sqft' })}
                  className="w-24 rounded-md border-gray-300 shadow-sm text-gray-900"
                >
                  <option>Sq Feet</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                'Renovation potential', 'Lot size', 'Neighbourhood',
                'Outdoor space', 'Price point', 'Parking',
                'Quality of build', 'Nearby attractions', 'Environment',
                'Basement', 'Rental income'
              ].map(highlight => (
                <button
                  key={highlight}
                  type="button"
                  onClick={() => handleHighlightToggle(highlight)}
                  className={`px-3 py-1 rounded-full border ${
                    formData.highlights.includes(highlight)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  } text-sm`}
                >
                  {highlight}
                </button>
              ))}
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Other details</h4>
              <textarea
                value={formData.otherDetails || ''}
                onChange={(e) => onChange({ otherDetails: e.target.value })}
                placeholder="Example: Open house dates, renovations / updates, any specific conditions etc."
                className="w-full h-32 rounded-md border-gray-300 shadow-sm text-gray-900"
              />
            </div>
          </form>
        </div>

        {/* Right Column - Property Highlights */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Property Highlights</h3>
          <p className="text-sm text-gray-600 mb-4">The AI will pay special attention to these areas.</p>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                'Renovation potential', 'Lot size', 'Neighbourhood',
                'Outdoor space', 'Price point', 'Parking',
                'Quality of build', 'Nearby attractions', 'Environment',
                'Basement', 'Rental income'
              ].map(highlight => (
                <button
                  key={highlight}
                  className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {highlight}
                </button>
              ))}
              <button className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                + Add your own
              </button>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Other details</h4>
              <textarea
                placeholder="Example: Open house dates, renovations / updates, any specific conditions etc."
                className="w-full h-32 rounded-md border-gray-300 shadow-sm text-gray-900"
              />
            </div>
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
          type="submit"
          className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
} 
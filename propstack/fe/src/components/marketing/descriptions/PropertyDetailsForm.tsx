"use client"

import { ChevronLeftIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'

interface PropertyDetailsFormProps {
  onBack: () => void
  formData: FormData
  onChange: (updates: Partial<FormData>) => void
}

interface FormErrors {
  bedrooms?: string
  bathrooms?: string
}

const CURRENCIES = [
  { symbol: '$', label: 'USD' },
  { symbol: '£', label: 'GBP' },
  { symbol: '€', label: 'EUR' },
  { symbol: '¥', label: 'JPY' },
] as const

const SIZE_UNITS = [
  { value: 'feet', label: 'Feet' },
  { value: 'meters', label: 'Meters' },
  { value: 'acres', label: 'Acres' },
  { value: 'hectares', label: 'Hectares' },
  { value: 'sqft', label: 'Sq Feet' },
  { value: 'sqm', label: 'Sq Meters' },
] as const

export function PropertyDetailsForm({ onBack, formData, onChange }: PropertyDetailsFormProps) {
  const [errors, setErrors] = useState<FormErrors>({})

  const validateForm = () => {
    const newErrors: FormErrors = {}

    if (!formData.bedrooms) {
      newErrors.bedrooms = 'Please enter number of bedrooms'
    }
    if (!formData.bathrooms) {
      newErrors.bathrooms = 'Please enter number of bathrooms'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      // Proceed to next step
    }
  }

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
            {/* Price with currency dropdown */}
            <div className="flex gap-2">
              <select
                className="w-16 rounded-md border-gray-300 shadow-sm text-gray-900"
                defaultValue="$"
                onChange={(e) => onChange({ currency: e.target.value })}
              >
                {CURRENCIES.map(({ symbol }) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={formData.price || ''}
                    onChange={(e) => onChange({ price: e.target.value })}
                    placeholder="Price (optional)"
                    className={`w-full rounded-md border-gray-300 shadow-sm text-gray-900 ${
                      formData.price ? 'pt-6' : ''
                    }`}
                  />
                  {formData.price && (
                    <label className="absolute left-2 top-1 text-xs text-gray-500">
                      Price (optional)
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Bedrooms */}
            <div className="relative">
              <input
                type="number"
                value={formData.bedrooms || ''}
                onChange={(e) => {
                  onChange({ bedrooms: e.target.value })
                  setErrors(prev => ({ ...prev, bedrooms: undefined }))
                }}
                placeholder="Bedrooms"
                className={`w-full rounded-md border-gray-300 shadow-sm text-gray-900 ${
                  formData.bedrooms ? 'pt-6' : ''
                } ${errors.bedrooms ? 'border-red-500' : ''}`}
              />
              {formData.bedrooms && (
                <label className="absolute left-2 top-1 text-xs text-gray-500">
                  Bedrooms
                </label>
              )}
              {errors.bedrooms && (
                <p className="mt-1 text-sm text-red-500">{errors.bedrooms}</p>
              )}
            </div>

            {/* Bathrooms */}
            <div className="relative">
              <input
                type="number"
                value={formData.bathrooms || ''}
                onChange={(e) => {
                  onChange({ bathrooms: e.target.value })
                  setErrors(prev => ({ ...prev, bathrooms: undefined }))
                }}
                placeholder="Bathrooms"
                className={`w-full rounded-md border-gray-300 shadow-sm text-gray-900 ${
                  formData.bathrooms ? 'pt-6' : ''
                } ${errors.bathrooms ? 'border-red-500' : ''}`}
              />
              {formData.bathrooms && (
                <label className="absolute left-2 top-1 text-xs text-gray-500">
                  Bathrooms
                </label>
              )}
              {errors.bathrooms && (
                <p className="mt-1 text-sm text-red-500">{errors.bathrooms}</p>
              )}
            </div>

            {/* Parking */}
            <div className="relative">
              <input
                type="text"
                value={formData.parking || ''}
                onChange={(e) => onChange({ parking: e.target.value })}
                placeholder="Parking (optional)"
                className={`w-full rounded-md border-gray-300 shadow-sm text-gray-900 ${
                  formData.parking ? 'pt-6' : ''
                }`}
              />
              {formData.parking && (
                <label className="absolute left-2 top-1 text-xs text-gray-500">
                  Parking (optional)
                </label>
              )}
            </div>

            {/* Lot Size */}
            <div className="relative flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={formData.lotSize || ''}
                  onChange={(e) => onChange({ lotSize: e.target.value })}
                  placeholder="Lot Size (optional)"
                  className={`w-full rounded-md border-gray-300 shadow-sm text-gray-900 ${
                    formData.lotSize ? 'pt-6' : ''
                  }`}
                />
                {formData.lotSize && (
                  <label className="absolute left-2 top-1 text-xs text-gray-500">
                    Lot Size (optional)
                  </label>
                )}
              </div>
              <select
                value={formData.lotSizeUnit || 'sqm'}
                onChange={(e) => onChange({ lotSizeUnit: e.target.value as typeof SIZE_UNITS[number]['value'] })}
                className="w-36 rounded-md border-gray-300 shadow-sm text-gray-900"
              >
                {SIZE_UNITS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Interior Size */}
            <div className="relative flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={formData.interiorSize || ''}
                  onChange={(e) => onChange({ interiorSize: e.target.value })}
                  placeholder="Interior Size (optional)"
                  className={`w-full rounded-md border-gray-300 shadow-sm text-gray-900 ${
                    formData.interiorSize ? 'pt-6' : ''
                  }`}
                />
                {formData.interiorSize && (
                  <label className="absolute left-2 top-1 text-xs text-gray-500">
                    Interior Size (optional)
                  </label>
                )}
              </div>
              <select
                value={formData.interiorSizeUnit || 'sqm'}
                onChange={(e) => onChange({ interiorSizeUnit: e.target.value as typeof SIZE_UNITS[number]['value'] })}
                className="w-36 rounded-md border-gray-300 shadow-sm text-gray-900"
              >
                {SIZE_UNITS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </form>
        </div>

        {/* Right Column - Property Highlights & Other Details */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <div className="space-y-6">
            {/* Highlights Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900">Property Highlights</h3>
              <p className="text-sm text-gray-600 mb-4">The AI will pay special attention to these areas.</p>
              
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
                <button className="px-3 py-1 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
                  + Add your own
                </button>
              </div>
            </div>

            {/* Other Details Section */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Other details</h4>
              <textarea
                value={formData.otherDetails || ''}
                onChange={(e) => onChange({ otherDetails: e.target.value })}
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
          onClick={handleNext}
          className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
} 
import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'

interface PropertyFeaturesFormProps {
  formData: AgentEngagementData
  onChange: (updates: Partial<AgentEngagementData>) => void
  onNext: () => void
  onBack: () => void
}

export function PropertyFeaturesForm({ formData, onChange, onNext, onBack }: PropertyFeaturesFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.propertyType) {
      newErrors.propertyType = 'Property type is required'
    }
    if (formData.bedrooms < 0) {
      newErrors.bedrooms = 'Bedrooms cannot be negative'
    }
    if (formData.bathrooms < 0) {
      newErrors.bathrooms = 'Bathrooms cannot be negative'
    }
    if (formData.carSpaces < 0) {
      newErrors.carSpaces = 'Car spaces cannot be negative'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* Property Type */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Property Type
            <div className="mt-1">
              <select
                value={formData.propertyType}
                onChange={(e) => onChange({ propertyType: e.target.value as AgentEngagementData['propertyType'] })}
                className="form-input"
              >
                <option value="">Select type...</option>
                <option value="house">House</option>
                <option value="unit">Unit</option>
                <option value="land">Land</option>
                <option value="other">Other</option>
              </select>
            </div>
          </label>
          {errors.propertyType && (
            <p className="mt-1 text-sm text-red-600">{errors.propertyType}</p>
          )}
        </div>

        {/* Property Features Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">
              Bedrooms
              <div className="mt-1">
                <input
                  type="number"
                  min="0"
                  value={formData.bedrooms}
                  onChange={(e) => onChange({ bedrooms: parseInt(e.target.value) })}
                  className="form-input"
                />
              </div>
            </label>
            {errors.bedrooms && (
              <p className="mt-1 text-sm text-red-600">{errors.bedrooms}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">
              Bathrooms
              <div className="mt-1">
                <input
                  type="number"
                  min="0"
                  value={formData.bathrooms}
                  onChange={(e) => onChange({ bathrooms: parseInt(e.target.value) })}
                  className="form-input"
                />
              </div>
            </label>
            {errors.bathrooms && (
              <p className="mt-1 text-sm text-red-600">{errors.bathrooms}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">
              Car Spaces
              <div className="mt-1">
                <input
                  type="number"
                  min="0"
                  value={formData.carSpaces}
                  onChange={(e) => onChange({ carSpaces: parseInt(e.target.value) })}
                  className="form-input"
                />
              </div>
            </label>
            {errors.carSpaces && (
              <p className="mt-1 text-sm text-red-600">{errors.carSpaces}</p>
            )}
          </div>
        </div>

        {/* Additional Features */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-4">Additional Features</h4>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.pool}
                onChange={(e) => onChange({ pool: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Pool</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.bodyCorp}
                onChange={(e) => onChange({ bodyCorp: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Body Corporate</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.electricalSafetySwitch}
                onChange={(e) => onChange({ electricalSafetySwitch: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Electrical Safety Switch</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.smokeAlarms}
                onChange={(e) => onChange({ smokeAlarms: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Smoke Alarms</span>
            </label>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Next
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
} 
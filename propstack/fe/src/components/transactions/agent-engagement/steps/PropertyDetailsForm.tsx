import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { Autocomplete } from '@react-google-maps/api'
import { useMaps } from '@/contexts/MapsContext'

interface PropertyDetailsFormProps {
  formData: AgentEngagementData
  onChange: (updates: Partial<AgentEngagementData>) => void
  onNext: () => void
  onBack?: () => void
  isFirstStep?: boolean
}

export function PropertyDetailsForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack, 
  isFirstStep 
}: PropertyDetailsFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { isLoaded } = useMaps()
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    setAutocomplete(autocomplete)
  }

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        onChange({ propertyAddress: place.formatted_address })
      }
    }
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.propertyAddress) {
      newErrors.propertyAddress = 'Property address is required'
    }
    if (!formData.spNumber) {
      newErrors.spNumber = 'Lot number is required'
    }
    if (!formData.surveyPlanNumber) {
      newErrors.surveyPlanNumber = 'Survey plan number is required'
    }
    if (!formData.titleReference) {
      newErrors.titleReference = 'Title reference is required'
    }
    if (!formData.deliveryMethod) {
      newErrors.deliveryMethod = 'Delivery method is required'
    }
    if (!formData.requiredDateTime) {
      newErrors.requiredDateTime = 'Required date/time is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* 1. Property Address */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Address of Property
            <div className="mt-1">
              {isLoaded ? (
                <Autocomplete
                  onLoad={onLoad}
                  onPlaceChanged={onPlaceChanged}
                >
                  <input
                    type="text"
                    value={formData.propertyAddress}
                    onChange={(e) => onChange({ propertyAddress: e.target.value })}
                    className="form-input"
                    placeholder="Start typing to search..."
                  />
                </Autocomplete>
              ) : (
                <input
                  type="text"
                  value={formData.propertyAddress}
                  onChange={(e) => onChange({ propertyAddress: e.target.value })}
                  className="form-input"
                  placeholder="Loading address search..."
                />
              )}
            </div>
          </label>
          {errors.propertyAddress && (
            <p className="mt-1 text-sm text-red-600">{errors.propertyAddress}</p>
          )}
        </div>

        {/* 2. Lot and Survey Plan Number */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Lot and Survey Plan Number
          </label>
          <div className="mt-1 grid grid-cols-2 gap-4">
            <div>
              <input
                type="text"
                value={formData.spNumber}
                onChange={(e) => onChange({ spNumber: e.target.value })}
                className={`form-input ${formData.spNumber ? 'font-medium' : ''}`}
                placeholder="Lot #"
              />
              {errors.spNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.spNumber}</p>
              )}
            </div>
            <div>
              <input
                type="text"
                value={formData.surveyPlanNumber}
                onChange={(e) => onChange({ surveyPlanNumber: e.target.value })}
                className={`form-input ${formData.surveyPlanNumber ? 'font-medium' : ''}`}
                placeholder="Survey Plan Number"
              />
              {errors.surveyPlanNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.surveyPlanNumber}</p>
              )}
            </div>
          </div>
        </div>

        {/* 3. Title Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Title Reference
            <div className="mt-1">
              <input
                type="text"
                value={formData.titleReference}
                onChange={(e) => onChange({ titleReference: e.target.value })}
                className="form-input"
                placeholder="Enter title reference"
              />
            </div>
          </label>
          {errors.titleReference && (
            <p className="mt-1 text-sm text-red-600">{errors.titleReference}</p>
          )}
        </div>

        {/* 4. Delivery Method */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Delivery Method
            <div className="mt-1">
              <select
                value={formData.deliveryMethod}
                onChange={(e) => onChange({ deliveryMethod: e.target.value as 'email' | 'hardcopy' })}
                className="form-input"
              >
                <option value="">Select method...</option>
                <option value="email">Email</option>
                <option value="hardcopy">Hard Copy</option>
              </select>
            </div>
          </label>
          {errors.deliveryMethod && (
            <p className="mt-1 text-sm text-red-600">{errors.deliveryMethod}</p>
          )}
        </div>

        {/* 5. Required Date/Time */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Required Date/Time
            <div className="mt-1">
              <input
                type="datetime-local"
                value={formData.requiredDateTime}
                onChange={(e) => onChange({ requiredDateTime: e.target.value })}
                className="form-input"
              />
            </div>
          </label>
          {errors.requiredDateTime && (
            <p className="mt-1 text-sm text-red-600">{errors.requiredDateTime}</p>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="mt-8 flex justify-between">
        {!isFirstStep && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <ChevronLeftIcon className="w-5 h-5 mr-2" />
            Back
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          className="inline-flex items-center px-4 py-2 text-sm text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 ml-auto"
        >
          Next
          <ChevronRightIcon className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  )
} 
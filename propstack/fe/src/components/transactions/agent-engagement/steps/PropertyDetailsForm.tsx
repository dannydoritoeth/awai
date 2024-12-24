import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { StandaloneSearchBox } from '@react-google-maps/api'
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider'

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
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const { isLoaded } = useGoogleMaps()

  const handlePlaceSelect = () => {
    if (searchBox) {
      const places = searchBox.getPlaces()
      if (places && places.length > 0) {
        const place = places[0]
        onChange({ propertyAddress: place.formatted_address || '' })
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
                <StandaloneSearchBox
                  onLoad={ref => setSearchBox(ref)}
                  onPlacesChanged={handlePlaceSelect}
                >
                  <input
                    type="text"
                    value={formData.propertyAddress}
                    onChange={(e) => onChange({ propertyAddress: e.target.value })}
                    className="form-input"
                    placeholder="Start typing to search..."
                  />
                </StandaloneSearchBox>
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

        {/* 5. Required By */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Required By
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

        {/* Navigation */}
        <div className="flex justify-between">
          {!isFirstStep && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <ChevronLeftIcon className="w-5 h-5" />
              Back
            </button>
          )}
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
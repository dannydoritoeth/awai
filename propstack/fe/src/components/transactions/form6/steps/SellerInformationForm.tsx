import { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { Form6Data } from '../types'
import { StandaloneSearchBox } from '@react-google-maps/api'
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider'

interface SellerInformationFormProps {
  formData: Form6Data
  onChange: (updates: Partial<Form6Data>) => void
  onNext: () => void
  onBack: () => void
}

export function SellerInformationForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: SellerInformationFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const { isLoaded } = useGoogleMaps()

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.sellerName) {
      newErrors.sellerName = 'Seller name is required'
    }
    if (!formData.sellerAddress) {
      newErrors.sellerAddress = 'Seller address is required'
    }
    if (!formData.sellerPhone) {
      newErrors.sellerPhone = 'Seller phone is required'
    }
    if (!formData.sellerEmail) {
      newErrors.sellerEmail = 'Seller email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.sellerEmail)) {
      newErrors.sellerEmail = 'Please enter a valid email'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  const handlePlaceSelect = () => {
    if (searchBox) {
      const places = searchBox.getPlaces()
      if (places && places.length > 0) {
        const place = places[0]
        onChange({ sellerAddress: place.formatted_address || '' })
      }
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* Seller Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Seller Name
            <div className="mt-1">
              <input
                type="text"
                value={formData.sellerName}
                onChange={(e) => onChange({ sellerName: e.target.value })}
                className="form-input"
                placeholder="Full legal name of seller"
              />
            </div>
          </label>
          {errors.sellerName && (
            <p className="mt-1 text-sm text-red-600">{errors.sellerName}</p>
          )}
        </div>

        {/* Seller Address with Google Places */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Seller Address
            <div className="mt-1">
              {isLoaded ? (
                <StandaloneSearchBox
                  onLoad={ref => setSearchBox(ref)}
                  onPlacesChanged={handlePlaceSelect}
                >
                  <input
                    type="text"
                    value={formData.sellerAddress}
                    onChange={(e) => onChange({ sellerAddress: e.target.value })}
                    className="form-input"
                    placeholder="Start typing to search..."
                  />
                </StandaloneSearchBox>
              ) : (
                <input
                  type="text"
                  value={formData.sellerAddress}
                  onChange={(e) => onChange({ sellerAddress: e.target.value })}
                  className="form-input"
                  placeholder="Loading address search..."
                />
              )}
            </div>
          </label>
          {errors.sellerAddress && (
            <p className="mt-1 text-sm text-red-600">{errors.sellerAddress}</p>
          )}
        </div>

        {/* Seller Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Seller Phone
            <div className="mt-1">
              <input
                type="tel"
                value={formData.sellerPhone}
                onChange={(e) => onChange({ sellerPhone: e.target.value })}
                className="form-input"
                placeholder="Contact phone number"
              />
            </div>
          </label>
          {errors.sellerPhone && (
            <p className="mt-1 text-sm text-red-600">{errors.sellerPhone}</p>
          )}
        </div>

        {/* Seller Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Seller Email
            <div className="mt-1">
              <input
                type="email"
                value={formData.sellerEmail}
                onChange={(e) => onChange({ sellerEmail: e.target.value })}
                className="form-input"
                placeholder="Email address"
              />
            </div>
          </label>
          {errors.sellerEmail && (
            <p className="mt-1 text-sm text-red-600">{errors.sellerEmail}</p>
          )}
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
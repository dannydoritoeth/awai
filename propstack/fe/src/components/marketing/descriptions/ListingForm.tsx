"use client"

import { useState, useRef, useEffect } from 'react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'
import { PropertyDetailsForm } from './PropertyDetailsForm'

interface FormData {
  address: string
  unitNumber?: string
  listingType: 'sale' | 'rent' | ''
  propertyType: 'house' | 'condo' | 'vacant-land' | 'multi-family' | 'townhouse' | 'other' | ''
  price?: string
  bedrooms?: string
  bathrooms?: string
  parking?: string
  lotSize?: string
  lotSizeUnit?: 'sqft' | 'acres'
  interiorSize?: string
  highlights: string[]
  otherDetails?: string
  fullAddress?: google.maps.places.PlaceResult
}

interface FormErrors {
  address?: string
  listingType?: string
  propertyType?: string
}

export function ListingForm() {
  const [formData, setFormData] = useState<FormData>({
    address: '',
    unitNumber: '',
    listingType: '',
    propertyType: '',
    highlights: []
  })

  const [inputValue, setInputValue] = useState('')
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const [step, setStep] = useState(1)
  const [isAddressSelected, setIsAddressSelected] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries: ['places']
  })

  useEffect(() => {
    if (step === 1) {
      setInputValue(formData.address)
    }
  }, [step])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
  }

  const handleNext = () => {
    if (validateForm()) {
      setStep(2)
    }
  }

  const handleBack = () => {
    setStep(1)
  }

  const handlePlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace()
    if (place) {
      const address = place.formatted_address || ''
      setInputValue(address)
      setFormData(prev => ({ ...prev, address, fullAddress: place }))
      setIsAddressSelected(true)
      setErrors(prev => ({ ...prev, address: undefined }))
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setIsAddressSelected(false)
    setFormData(prev => ({ ...prev, address: e.target.value, fullAddress: undefined }))
  }

  const validateForm = () => {
    const newErrors: FormErrors = {}

    if (!isAddressSelected) {
      newErrors.address = 'Please select an address'
    }
    if (!formData.listingType) {
      newErrors.listingType = 'Please select if this is for sale or rent'
    }
    if (!formData.propertyType) {
      newErrors.propertyType = 'Please select a property type'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  if (step === 2) {
    return (
      <PropertyDetailsForm 
        onBack={handleBack}
        formData={formData}
        onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
      />
    )
  }

  return (
    <>
      <div className="flex gap-4">
        {/* Left Column - Listing Details */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Listing Details</h3>
          <form className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700">Address</label>
              {isLoaded ? (
                <Autocomplete
                  onLoad={autocomplete => {
                    autocompleteRef.current = autocomplete
                    autocomplete.setFields(['formatted_address'])
                  }}
                  options={{ fields: ['formatted_address'] }}
                  onPlaceChanged={handlePlaceChanged}
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Start typing an address..."
                  />
                </Autocomplete>
              ) : (
                <input type="text" className="form-input" disabled />
              )}
              {errors.address && <p className="text-red-500">{errors.address}</p>}
            </div>

            <div>
              <label className="block text-sm text-gray-700">Unit number (optional)</label>
              <input
                type="text"
                value={formData.unitNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, unitNumber: e.target.value }))}
                className="form-input"
              />
            </div>

            <div className="flex gap-4 text-gray-700">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="listingType"
                  value="sale"
                  checked={formData.listingType === 'sale'}
                  onChange={(e) => setFormData(prev => ({ ...prev, listingType: 'sale' }))}
                  className="mr-2"
                />
                For sale
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="listingType"
                  value="rent"
                  checked={formData.listingType === 'rent'}
                  onChange={(e) => setFormData(prev => ({ ...prev, listingType: 'rent' }))}
                  className="mr-2"
                />
                For rent
              </label>
              {errors.listingType && <p className="text-red-500">{errors.listingType}</p>}
            </div>
          </form>
        </div>

        {/* Right Column - Property Type */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Property Type</h3>
          <div className="grid grid-cols-2 gap-4 text-gray-700">
            {[
              { value: 'house', label: 'House' },
              { value: 'multi-family', label: 'Multi-family' },
              { value: 'condo', label: 'Condo' },
              { value: 'townhouse', label: 'Townhouse' },
              { value: 'vacant-land', label: 'Vacant land' },
              { value: 'other', label: 'Other' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center">
                <input
                  type="radio"
                  name="propertyType"
                  value={value}
                  checked={formData.propertyType === value}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      propertyType: value as FormData['propertyType']
                    }))
                  }}
                  className="mr-2"
                />
                {label}
              </label>
            ))}
            {errors.propertyType && <p className="text-red-500">{errors.propertyType}</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-4">
        <button
          onClick={handleNext}
          className="bg-blue-600 text-white px-8 py-2 rounded-md hover:bg-blue-700 transition-colors w-full max-w-xs"
        >
          Next
        </button>
      </div>
    </>
  )
} 
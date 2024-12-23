"use client"

import { useState, useRef, useEffect } from 'react'
import { Autocomplete } from '@react-google-maps/api'
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider'
import { PropertyDetailsForm } from './PropertyDetailsForm'
import { LocationFeaturesForm } from './LocationFeaturesForm'
import { ListingPreview } from './ListingPreview'
import { DescriptionGenerator } from './DescriptionGenerator'

interface ListingFormData {
  address: string
  unitNumber?: string
  listingType: 'sale' | 'rent' | ''
  propertyType: 'house' | 'condo' | 'vacant-land' | 'multi-family' | 'townhouse' | 'other' | ''
  price?: string
  bedrooms?: string
  bathrooms?: string
  parking?: string
  lotSize?: string
  lotSizeUnit?: 'feet' | 'meters' | 'acres' | 'hectares' | 'sqft' | 'sqm'
  interiorSize?: string
  interiorSizeUnit?: 'feet' | 'meters' | 'acres' | 'hectares' | 'sqft' | 'sqm'
  highlights: string[]
  otherDetails?: string
  fullAddress?: google.maps.places.PlaceResult
}

interface FormErrors {
  address?: string
  listingType?: string
  propertyType?: string
}

const initialFormData: ListingFormData = {
  address: '',
  unitNumber: '',
  listingType: '',
  propertyType: '',
  lotSizeUnit: 'sqm',
  interiorSizeUnit: 'sqm',
  highlights: []
}

export function ListingForm() {
  const [formData, setFormData] = useState<ListingFormData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('listingFormData')
      const currentStep = localStorage.getItem('listingFormStep')
      
      // Clear data if we're starting fresh (no step saved)
      if (!currentStep) {
        localStorage.removeItem('listingFormData')
        return initialFormData
      }
      
      return saved ? JSON.parse(saved) : initialFormData
    }
    return initialFormData
  })

  const [step, setStep] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedStep = localStorage.getItem('listingFormStep')
      return savedStep ? parseInt(savedStep) : 1
    }
    return 1
  })

  // Save form data and step to localStorage
  useEffect(() => {
    localStorage.setItem('listingFormData', JSON.stringify(formData))
    localStorage.setItem('listingFormStep', step.toString())
  }, [formData, step])

  // Clear everything when unmounting
  useEffect(() => {
    return () => {
      localStorage.removeItem('listingFormData')
      localStorage.removeItem('listingFormStep')
    }
  }, [])

  const handleNext = () => {
    if (validateForm()) {
      setStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    setStep(prev => prev - 1)
  }

  const [inputValue, setInputValue] = useState('')
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  const [isAddressSelected, setIsAddressSelected] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const { isLoaded } = useGoogleMaps()

  useEffect(() => {
    console.log('Google Maps loaded:', isLoaded)
    console.log('Window google object:', window.google)
  }, [isLoaded])

  useEffect(() => {
    if (step === 1) {
      setInputValue(formData.address)
    }
  }, [step])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
  }

  const handlePlaceChanged = () => {
    try {
      const place = autocompleteRef.current?.getPlace()
      console.log('Selected place:', place)
      if (place) {
        const address = place.formatted_address || ''
        setInputValue(address)
        setFormData(prev => ({ ...prev, address, fullAddress: place }))
        setIsAddressSelected(true)
        setErrors(prev => ({ ...prev, address: undefined }))
      }
    } catch (error) {
      console.error('Error in handlePlaceChanged:', error)
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

  const renderAutocomplete = () => {
    try {
      return isLoaded ? (
        <Autocomplete
          onLoad={autocomplete => {
            console.log('Autocomplete loaded')
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
      )
    } catch (error) {
      console.error('Error rendering Autocomplete:', error)
      return <input type="text" className="form-input" disabled />
    }
  }

  if (step === 4) {
    return (
      <DescriptionGenerator 
        onBack={() => setStep(3)}
        formData={formData}
      />
    )
  }

  if (step === 3) {
    return (
      <LocationFeaturesForm 
        onBack={() => setStep(2)}
        onNext={() => setStep(4)}
        formData={formData}
        onChange={(updates) => {
          setFormData(prev => ({
            ...prev,
            ...updates,
            highlights: updates.highlights || []
          }))
        }}
      />
    )
  }

  if (step === 2) {
    return (
      <PropertyDetailsForm 
        onBack={() => setStep(1)}
        formData={formData}
        onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
        onNext={() => setStep(3)}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 pb-4">
        {/* Listing Details */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Listing Details</h3>
          <form className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700">Address</label>
              {renderAutocomplete()}
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

        {/* Property Type */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900">Property Type</h3>
          <div className="grid grid-cols-2 gap-4 text-gray-700">
            {[
              { value: 'house', label: 'House' },
              { value: 'multi-family', label: 'Multi-family' },
              { value: 'condo', label: 'Apartment / Condo' },
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
                      propertyType: value as ListingFormData['propertyType']
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

      {/* Next button */}
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
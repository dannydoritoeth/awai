"use client"

import { useRef, useCallback, useState, useEffect } from 'react'
import { Autocomplete } from '@react-google-maps/api'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { useMaps } from '@/contexts/MapsContext'

interface BasicPropertyFormProps {
  data: any
  onUpdate: (data: any) => void
  onNext: () => void
}

export function BasicPropertyForm({ data, onUpdate, onNext }: BasicPropertyFormProps) {
  const { isLoaded, loadError } = useMaps()
  const [inputValue, setInputValue] = useState(data.address || '')
  const [addressSelected, setAddressSelected] = useState(false)
  const [validationError, setValidationError] = useState('')
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const initialLoadRef = useRef(true)

  // Handle initial pre-filled address
  useEffect(() => {
    if (initialLoadRef.current && isLoaded && data.address && data.latitude && data.longitude) {
      initialLoadRef.current = false
      setAddressSelected(true)
      setInputValue(data.address)
      setValidationError('')
      
      // Simulate a place selection with the existing data
      onUpdate({
        ...data,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        addressSelected: true
      })
    }
  }, [isLoaded, data, onUpdate])

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete
  }, [])

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace()
      
      if (place.geometry && place.formatted_address) {
        onUpdate({
          ...data,
          address: place.formatted_address,
          latitude: place.geometry.location?.lat(),
          longitude: place.geometry.location?.lng(),
          addressSelected: true
        })
        setInputValue(place.formatted_address)
        setAddressSelected(true)
        setValidationError('')
      }
    }
  }, [data, onUpdate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!addressSelected && !data.addressSelected) {
      setValidationError('Please select a valid address from the dropdown')
      return
    }

    onNext()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    if (!value) {
      setAddressSelected(false)
      onUpdate({
        ...data,
        address: '',
        latitude: null,
        longitude: null,
        addressSelected: false
      })
    } else if (value !== data.address) {
      setAddressSelected(false)
    }
  }

  if (loadError) {
    return <div>Error loading Google Maps</div>
  }

  if (!isLoaded) {
    return <div>Loading...</div>
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Basic Property Details</h2>

      <div className="space-y-4">
        {/* Address with Google Places Autocomplete */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Property Address
          </label>
          <Autocomplete
            onLoad={onLoad}
            onPlaceChanged={onPlaceChanged}
            options={{
              types: ["address"],
              fields: ["formatted_address", "geometry", "place_id"]
            }}
          >
            <input
              type="text"
              id="address"
              value={inputValue}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 
                ${validationError ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="Enter address"
              required
            />
          </Autocomplete>
          {validationError && (
            <p className="mt-1 text-sm text-red-600">
              {validationError}
            </p>
          )}
        </div>

        {/* Property Type */}
        <div>
          <label htmlFor="propertyType" className="block text-sm font-medium text-gray-700">
            Property Type
          </label>
          <select
            id="propertyType"
            value={data.propertyType || ''}
            onChange={(e) => onUpdate({ ...data, propertyType: e.target.value })}
            className="form-select mt-1"
            required
          >
            <option value="">Select type</option>
            <option value="house">House</option>
            <option value="apartment">Apartment</option>
            <option value="land">Land</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Listing Type */}
        <div>
          <label htmlFor="listingType" className="block text-sm font-medium text-gray-700">
            Listing Type
          </label>
          <select
            id="listingType"
            value={data.listingType || ''}
            onChange={(e) => onUpdate({ ...data, listingType: e.target.value })}
            className="form-select mt-1"
            required
          >
            <option value="">Select type</option>
            <option value="sale">For Sale</option>
            <option value="auction">For Auction</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-6">
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
"use client"

import { useState } from 'react'
import { useLoadScript, Autocomplete } from '@react-google-maps/api'

interface FormData {
  address: string
  unitNumber?: string
  listingType: 'sale' | 'rent' | ''
  propertyType: 'house' | 'condo' | 'vacant-land' | 'multi-family' | 'townhouse' | 'other' | ''
}

export function ListingForm() {
  const [formData, setFormData] = useState<FormData>({
    address: '',
    unitNumber: '',
    listingType: '',
    propertyType: ''
  })

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries: ['places']
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
  }

  return (
    <div className="flex gap-4">
      {/* Left Column - Listing Details */}
      <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900">Listing Details</h3>
        <form className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700">Address</label>
            {isLoaded ? (
              <Autocomplete>
                <input
                  type="text"
                  className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
                  placeholder="Start typing an address..."
                />
              </Autocomplete>
            ) : (
              <input type="text" className="w-full rounded-md border-gray-300 shadow-sm text-gray-900" disabled />
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-700">Unit number (optional)</label>
            <input
              type="text"
              className="w-full rounded-md border-gray-300 shadow-sm text-gray-900"
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
                onChange={(e) => setFormData(prev => ({ ...prev, propertyType: value as FormData['propertyType'] }))}
                className="mr-2"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
} 
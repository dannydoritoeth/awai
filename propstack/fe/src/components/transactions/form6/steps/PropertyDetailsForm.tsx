import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { Form6Data } from '../types'
import { StandaloneSearchBox } from '@react-google-maps/api'
import { useGoogleMaps } from '@/components/maps/GoogleMapsProvider'

interface PropertyDetailsFormProps {
  formData: Form6Data
  onChange: (updates: Partial<Form6Data>) => void
  onNext: () => void
  onBack: () => void
}

export function PropertyDetailsForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: PropertyDetailsFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const { isLoaded } = useGoogleMaps()

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.propertyAddress) {
      newErrors.propertyAddress = 'Property address is required'
    }
    if (!formData.titleReference) {
      newErrors.titleReference = 'Title reference is required'
    }
    if (!formData.spNumber) {
      newErrors.spNumber = 'SP number is required'
    }
    if (formData.saleMethod === 'private' && !formData.listPrice) {
      newErrors.listPrice = 'List price is required for private sale'
    }
    if (formData.saleMethod === 'auction') {
      if (!formData.auctionDetails?.date) {
        newErrors.auctionDate = 'Auction date is required'
      }
      if (!formData.auctionDetails?.time) {
        newErrors.auctionTime = 'Auction time is required'
      }
      if (!formData.auctionDetails?.venue) {
        newErrors.auctionVenue = 'Auction venue is required'
      }
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
        onChange({ propertyAddress: place.formatted_address || '' })
      }
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* Property Address with Google Places */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Property Address
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

        {/* Title Reference & SP Number */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Title Reference
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={formData.titleReference}
                  onChange={(e) => onChange({ titleReference: e.target.value })}
                  className="form-input"
                  placeholder="Enter title reference"
                />
                <div className="group relative">
                  <InfoIcon className="w-4 h-4 text-gray-400" />
                  <div className="hidden group-hover:block absolute left-6 top-0 bg-gray-800 text-white p-2 rounded text-sm w-48">
                    Title reference number from RP Data
                  </div>
                </div>
              </div>
            </label>
            {errors.titleReference && (
              <p className="mt-1 text-sm text-red-600">{errors.titleReference}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              SP Number
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  value={formData.spNumber}
                  onChange={(e) => onChange({ spNumber: e.target.value })}
                  className="form-input"
                  placeholder="Enter SP number"
                />
                <div className="group relative">
                  <InfoIcon className="w-4 h-4 text-gray-400" />
                  <div className="hidden group-hover:block absolute left-6 top-0 bg-gray-800 text-white p-2 rounded text-sm w-48">
                    Survey Plan number if applicable
                  </div>
                </div>
              </div>
            </label>
            {errors.spNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.spNumber}</p>
            )}
          </div>
        </div>

        {/* Sale Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Sale Method
            <div className="mt-1">
              <select
                value={formData.saleMethod}
                onChange={(e) => onChange({ 
                  saleMethod: e.target.value as 'private' | 'auction',
                  // Clear irrelevant fields
                  listPrice: e.target.value === 'auction' ? undefined : formData.listPrice,
                  auctionDetails: e.target.value === 'private' ? undefined : formData.auctionDetails
                })}
                className="form-input"
              >
                <option value="private">Private Sale</option>
                <option value="auction">Auction</option>
              </select>
            </div>
          </label>
        </div>

        {/* Conditional Fields based on Sale Method */}
        {formData.saleMethod === 'private' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              List Price
              <div className="mt-1">
                <input
                  type="text"
                  value={formData.listPrice}
                  onChange={(e) => onChange({ listPrice: e.target.value })}
                  className="form-input"
                  placeholder="Enter list price"
                />
              </div>
            </label>
            {errors.listPrice && (
              <p className="mt-1 text-sm text-red-600">{errors.listPrice}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Auction Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date
                  <div className="mt-1">
                    <input
                      type="date"
                      value={formData.auctionDetails?.date}
                      onChange={(e) => onChange({ 
                        auctionDetails: { 
                          date: e.target.value,
                          time: formData.auctionDetails?.time || '',
                          venue: formData.auctionDetails?.venue || ''
                        } 
                      })}
                      className="form-input"
                    />
                  </div>
                </label>
                {errors.auctionDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.auctionDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Time
                  <div className="mt-1">
                    <input
                      type="time"
                      value={formData.auctionDetails?.time}
                      onChange={(e) => onChange({ 
                        auctionDetails: { 
                          date: formData.auctionDetails?.date || '',
                          time: e.target.value,
                          venue: formData.auctionDetails?.venue || ''
                        } 
                      })}
                      className="form-input"
                    />
                  </div>
                </label>
                {errors.auctionTime && (
                  <p className="mt-1 text-sm text-red-600">{errors.auctionTime}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Venue
                <div className="mt-1">
                  <input
                    type="text"
                    value={formData.auctionDetails?.venue}
                    onChange={(e) => onChange({ 
                      auctionDetails: { 
                        date: formData.auctionDetails?.date || '',
                        time: formData.auctionDetails?.time || '',
                        venue: e.target.value
                      } 
                    })}
                    className="form-input"
                    placeholder="Enter auction venue"
                  />
                </div>
              </label>
              {errors.auctionVenue && (
                <p className="mt-1 text-sm text-red-600">{errors.auctionVenue}</p>
              )}
            </div>
          </div>
        )}

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
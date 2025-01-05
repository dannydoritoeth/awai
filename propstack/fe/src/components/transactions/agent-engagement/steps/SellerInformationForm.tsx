"use client"

import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'
import { Autocomplete } from '@react-google-maps/api'
import { useMaps } from '@/contexts/MapsContext'

interface SellerInformationFormProps {
  formData: AgentEngagementData
  onChange: (updates: Partial<AgentEngagementData>) => void
  onNext: () => void
  onBack: () => void
}

export function SellerInformationForm({ formData, onChange, onNext, onBack }: SellerInformationFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { isLoaded } = useMaps()
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null)

  const validateEmail = (email: string) => {
    // Basic email format validation
    const basicFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!basicFormat.test(email)) {
      return 'Please enter a valid email address'
    }

    // Additional validations
    if (email.length > 254) {
      return 'Email address is too long'
    }

    const [localPart, domain] = email.split('@')
    if (localPart.length > 64) {
      return 'Email username is too long'
    }

    // Check for common typos in domain names
    const commonDomains: { [key: string]: string } = {
      'gmial': 'gmail',
      'gmal': 'gmail',
      'gamil': 'gmail',
      'hotmal': 'hotmail',
      'hotnail': 'hotmail',
      'hotmai': 'hotmail',
      'yahooo': 'yahoo',
      'yaho': 'yahoo',
      'outloo': 'outlook',
      'outlok': 'outlook'
    }

    const domainPart = domain.split('.')[0].toLowerCase()
    if (commonDomains[domainPart]) {
      return `Did you mean ${email.replace(domainPart, commonDomains[domainPart])}?`
    }

    return ''
  }

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
    } else {
      const emailError = validateEmail(formData.sellerEmail)
      if (emailError) {
        newErrors.sellerEmail = emailError
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleEmailChange = (email: string) => {
    onChange({ sellerEmail: email })
    if (email) {
      const emailError = validateEmail(email)
      setErrors(prev => ({
        ...prev,
        sellerEmail: emailError
      }))
    } else {
      setErrors(prev => ({
        ...prev,
        sellerEmail: 'Seller email is required'
      }))
    }
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    setAutocomplete(autocomplete)
  }

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace()
      if (place.formatted_address) {
        onChange({ sellerAddress: place.formatted_address })
      }
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Seller Name */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Full Name/s of Seller
            <div className="mt-1">
              <input
                type="text"
                value={formData.sellerName}
                onChange={(e) => onChange({ sellerName: e.target.value.toUpperCase() })}
                className="form-input uppercase"
                placeholder="Full legal name"
                autoComplete="off"
              />
            </div>
          </label>
          {errors.sellerName && (
            <p className="mt-1 text-sm text-red-600">{errors.sellerName}</p>
          )}
        </div>

        {/* Seller Address */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Seller Address
            <div className="mt-1">
              {isLoaded ? (
                <Autocomplete
                  onLoad={onLoad}
                  onPlaceChanged={onPlaceChanged}
                >
                  <input
                    type="text"
                    value={formData.sellerAddress}
                    onChange={(e) => onChange({ sellerAddress: e.target.value })}
                    className="form-input"
                    placeholder="Start typing to search..."
                    autoComplete="off"
                  />
                </Autocomplete>
              ) : (
                <input
                  type="text"
                  value={formData.sellerAddress}
                  onChange={(e) => onChange({ sellerAddress: e.target.value })}
                  className="form-input"
                  placeholder="Loading address search..."
                  autoComplete="off"
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
          <label className="block text-sm font-medium text-gray-500">
            Seller Phone
            <div className="mt-1">
              <input
                type="tel"
                value={formData.sellerPhone}
                onChange={(e) => onChange({ sellerPhone: e.target.value })}
                className="form-input"
                placeholder="Phone number"
                autoComplete="off"
              />
            </div>
          </label>
          {errors.sellerPhone && (
            <p className="mt-1 text-sm text-red-600">{errors.sellerPhone}</p>
          )}
        </div>

        {/* Seller Email */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Seller Email
            <div className="mt-1">
              <input
                type="email"
                value={formData.sellerEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={`form-input ${errors.sellerEmail?.includes('Did you mean') ? 'border-yellow-500' : ''}`}
                placeholder="Email address"
                autoComplete="off"
              />
            </div>
          </label>
          {errors.sellerEmail && (
            <p className={`mt-1 text-sm ${errors.sellerEmail.includes('Did you mean') ? 'text-yellow-600' : 'text-red-600'}`}>
              {errors.sellerEmail}
            </p>
          )}
        </div>

        {/* Sale Method */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Sale Method
            <div className="mt-1">
              <select
                value={formData.saleMethod}
                onChange={(e) => onChange({ 
                  saleMethod: e.target.value as 'private' | 'auction',
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

          {/* Conditional fields based on sale method */}
          {formData.saleMethod === 'private' ? (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-500">
                List Price
                <div className="mt-1">
                  <input
                    type="text"
                    value={formData.listPrice}
                    onChange={(e) => onChange({ listPrice: e.target.value })}
                    className="form-input"
                    placeholder="Enter list price"
                    autoComplete="off"
                  />
                </div>
              </label>
              {errors.listPrice && (
                <p className="mt-1 text-sm text-red-600">{errors.listPrice}</p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  Auction Date
                  <div className="mt-1">
                    <input
                      type="date"
                      value={formData.auctionDetails?.date}
                      onChange={(e) => onChange({ 
                        auctionDetails: { 
                          ...formData.auctionDetails,
                          date: e.target.value 
                        } 
                      })}
                      className="form-input"
                      autoComplete="off"
                    />
                  </div>
                </label>
                {errors.auctionDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.auctionDate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">
                  Auction Time
                  <div className="mt-1">
                    <input
                      type="time"
                      value={formData.auctionDetails?.time}
                      onChange={(e) => onChange({ 
                        auctionDetails: { 
                          ...formData.auctionDetails,
                          time: e.target.value 
                        } 
                      })}
                      className="form-input"
                      autoComplete="off"
                    />
                  </div>
                </label>
                {errors.auctionTime && (
                  <p className="mt-1 text-sm text-red-600">{errors.auctionTime}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">
                  Auction Venue
                  <div className="mt-1">
                    <input
                      type="text"
                      value={formData.auctionDetails?.venue}
                      onChange={(e) => onChange({ 
                        auctionDetails: { 
                          ...formData.auctionDetails,
                          venue: e.target.value 
                        } 
                      })}
                      className="form-input"
                      placeholder="Enter auction venue"
                      autoComplete="off"
                    />
                  </div>
                </label>
                {errors.auctionVenue && (
                  <p className="mt-1 text-sm text-red-600">{errors.auctionVenue}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Next
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
} 
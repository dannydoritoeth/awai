"use client"

import { useState, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface PropertyFeaturesFormProps {
  data: any
  onUpdate: (data: any) => void
  onNext: () => void
  onBack: () => void
}

const CURRENCIES = [
  { symbol: '$' },
  { symbol: '£' },
  { symbol: '€' },
  { symbol: '¥' },
] as const

const SIZE_UNITS = [
  { value: 'sqm', label: 'Sq Meters' },
  { value: 'sqft', label: 'Sq Feet' },
  { value: 'acres', label: 'Acres' },
  { value: 'hectares', label: 'Hectares' },
] as const

export function PropertyFeaturesForm({ data, onUpdate, onNext, onBack }: PropertyFeaturesFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Set default units to sqm if not set
  useEffect(() => {
    if (!data.interiorSizeUnit) {
      onUpdate({ ...data, interiorSizeUnit: 'sqm' })
    }
    if (!data.lotSizeUnit) {
      onUpdate({ ...data, lotSizeUnit: 'sqm' })
    }
  }, [])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    // Validate price
    if (!data.price || data.price.trim() === '') {
      newErrors.price = 'Price is required'
    } else if (Number(data.price) <= 0) {
      newErrors.price = 'Price must be greater than 0'
    }

    // Validate interior size
    if (data.interiorSize && !data.interiorSizeUnit) {
      newErrors.interiorSizeUnit = 'Please select a unit'
    }
    if (data.interiorSizeUnit && !data.interiorSize) {
      newErrors.interiorSize = 'Please enter a size'
    }
    if (data.interiorSize && Number(data.interiorSize) <= 0) {
      newErrors.interiorSize = 'Size must be greater than 0'
    }

    // Validate lot size
    if (data.lotSize && !data.lotSizeUnit) {
      newErrors.lotSizeUnit = 'Please select a unit'
    }
    if (data.lotSizeUnit && !data.lotSize) {
      newErrors.lotSize = 'Please enter a size'
    }
    if (data.lotSize && Number(data.lotSize) <= 0) {
      newErrors.lotSize = 'Size must be greater than 0'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onNext()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Property Features</h2>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="space-y-4">
          {/* Price with currency */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">
              Price
            </label>
            <div className="flex gap-2 mt-1">
              <select
                value={data.currency || '$'}
                onChange={(e) => onUpdate({ ...data, currency: e.target.value })}
                className="w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {CURRENCIES.map(({ symbol }) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>
              <input
                type="number"
                id="price"
                value={data.price || ''}
                onChange={(e) => onUpdate({ ...data, price: e.target.value })}
                placeholder="Price"
                className={`flex-1 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 
                  ${errors.price ? 'border-red-300' : 'border-gray-300'}`}
                required
                min="0"
                step="0.01"
              />
            </div>
            {errors.price && (
              <p className="mt-1 text-sm text-red-600">{errors.price}</p>
            )}
          </div>

          {/* Bedrooms & Bathrooms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="bedrooms" className="block text-sm font-medium text-gray-700">
                Bedrooms
              </label>
              <input
                type="number"
                id="bedrooms"
                value={data.bedrooms || ''}
                onChange={(e) => onUpdate({ ...data, bedrooms: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                min="0"
              />
            </div>
            <div>
              <label htmlFor="bathrooms" className="block text-sm font-medium text-gray-700">
                Bathrooms
              </label>
              <input
                type="number"
                id="bathrooms"
                value={data.bathrooms || ''}
                onChange={(e) => onUpdate({ ...data, bathrooms: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
                min="0"
              />
            </div>
          </div>

          {/* Parking */}
          <div>
            <label htmlFor="parking" className="block text-sm font-medium text-gray-700">
              Parking Spaces
            </label>
            <input
              type="number"
              id="parking"
              value={data.parking || ''}
              onChange={(e) => onUpdate({ ...data, parking: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              min="0"
            />
          </div>

          {/* Interior Size */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="interiorSize" className="block text-sm font-medium text-gray-700">
                Interior Size
              </label>
              <input
                type="number"
                id="interiorSize"
                value={data.interiorSize || ''}
                onChange={(e) => onUpdate({ ...data, interiorSize: e.target.value })}
                className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 
                  ${errors.interiorSize ? 'border-red-300' : 'border-gray-300'}`}
                min="0"
                step="0.01"
              />
              {errors.interiorSize && (
                <p className="mt-1 text-sm text-red-600">{errors.interiorSize}</p>
              )}
            </div>
            <div className="w-32">
              <label htmlFor="interiorSizeUnit" className="block text-sm font-medium text-gray-700">
                Unit
              </label>
              <select
                id="interiorSizeUnit"
                value={data.interiorSizeUnit || 'sqm'}
                onChange={(e) => onUpdate({ ...data, interiorSizeUnit: e.target.value })}
                className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 
                  ${errors.interiorSizeUnit ? 'border-red-300' : 'border-gray-300'}`}
              >
                {SIZE_UNITS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {errors.interiorSizeUnit && (
                <p className="mt-1 text-sm text-red-600">{errors.interiorSizeUnit}</p>
              )}
            </div>
          </div>

          {/* Lot Size */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="lotSize" className="block text-sm font-medium text-gray-700">
                Lot Size
              </label>
              <input
                type="number"
                id="lotSize"
                value={data.lotSize || ''}
                onChange={(e) => onUpdate({ ...data, lotSize: e.target.value })}
                className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 
                  ${errors.lotSize ? 'border-red-300' : 'border-gray-300'}`}
                min="0"
                step="0.01"
              />
              {errors.lotSize && (
                <p className="mt-1 text-sm text-red-600">{errors.lotSize}</p>
              )}
            </div>
            <div className="w-32">
              <label htmlFor="lotSizeUnit" className="block text-sm font-medium text-gray-700">
                Unit
              </label>
              <select
                id="lotSizeUnit"
                value={data.lotSizeUnit || 'sqm'}
                onChange={(e) => onUpdate({ ...data, lotSizeUnit: e.target.value })}
                className={`mt-1 block w-full rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 
                  ${errors.lotSizeUnit ? 'border-red-300' : 'border-gray-300'}`}
              >
                {SIZE_UNITS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {errors.lotSizeUnit && (
                <p className="mt-1 text-sm text-red-600">{errors.lotSizeUnit}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back
        </button>
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
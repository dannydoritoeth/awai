"use client"

import { useState } from 'react'
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
  { value: 'sqft', label: 'Sq Feet' },
  { value: 'sqm', label: 'Sq Meters' },
  { value: 'acres', label: 'Acres' },
  { value: 'hectares', label: 'Hectares' },
] as const

export function PropertyFeaturesForm({ data, onUpdate, onNext, onBack }: PropertyFeaturesFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Property Features</h2>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="space-y-4">
          {/* Price with currency */}
          <div className="flex gap-2">
            <select
              value={data.currency || '$'}
              onChange={(e) => onUpdate({ currency: e.target.value })}
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
              value={data.price || ''}
              onChange={(e) => onUpdate({ price: e.target.value })}
              placeholder="Price"
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
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
                onChange={(e) => onUpdate({ bedrooms: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
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
                onChange={(e) => onUpdate({ bathrooms: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
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
              onChange={(e) => onUpdate({ parking: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
                onChange={(e) => onUpdate({ interiorSize: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="w-32">
              <label htmlFor="interiorSizeUnit" className="block text-sm font-medium text-gray-700">
                Unit
              </label>
              <select
                id="interiorSizeUnit"
                value={data.interiorSizeUnit || 'sqft'}
                onChange={(e) => onUpdate({ interiorSizeUnit: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {SIZE_UNITS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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
                onChange={(e) => onUpdate({ lotSize: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="w-32">
              <label htmlFor="lotSizeUnit" className="block text-sm font-medium text-gray-700">
                Unit
              </label>
              <select
                id="lotSizeUnit"
                value={data.lotSizeUnit || 'sqft'}
                onChange={(e) => onUpdate({ lotSizeUnit: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {SIZE_UNITS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
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
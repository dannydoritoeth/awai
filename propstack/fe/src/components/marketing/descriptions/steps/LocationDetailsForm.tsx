"use client"

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface LocationDetailsFormProps {
  data: any // Replace with proper type
  onUpdate: (data: any) => void
  onNext: () => void
  onBack: () => void
}

export function LocationDetailsForm({ data, onUpdate, onNext, onBack }: LocationDetailsFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Location Details</h2>

      <div className="space-y-4">
        {/* Suburb */}
        <div>
          <label htmlFor="suburb" className="block text-sm font-medium text-gray-700">
            Suburb
          </label>
          <input
            type="text"
            id="suburb"
            value={data.suburb || ''}
            onChange={(e) => onUpdate({ ...data, suburb: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        {/* State */}
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700">
            State
          </label>
          <select
            id="state"
            value={data.state || ''}
            onChange={(e) => onUpdate({ ...data, state: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          >
            <option value="">Select state</option>
            <option value="NSW">New South Wales</option>
            <option value="VIC">Victoria</option>
            <option value="QLD">Queensland</option>
            <option value="WA">Western Australia</option>
            <option value="SA">South Australia</option>
            <option value="TAS">Tasmania</option>
            <option value="ACT">Australian Capital Territory</option>
            <option value="NT">Northern Territory</option>
          </select>
        </div>

        {/* Postcode */}
        <div>
          <label htmlFor="postcode" className="block text-sm font-medium text-gray-700">
            Postcode
          </label>
          <input
            type="text"
            id="postcode"
            value={data.postcode || ''}
            onChange={(e) => onUpdate({ ...data, postcode: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
            maxLength={4}
            pattern="[0-9]*"
          />
        </div>

        {/* Location Description */}
        <div>
          <label htmlFor="locationDescription" className="block text-sm font-medium text-gray-700">
            Location Description
          </label>
          <textarea
            id="locationDescription"
            value={data.locationDescription || ''}
            onChange={(e) => onUpdate({ ...data, locationDescription: e.target.value })}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Describe the location, nearby amenities, etc."
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
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
"use client"

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface FeaturesFormProps {
  data: any
  onUpdate: (data: any) => void
  onNext: () => void
  onBack: () => void
}

export function FeaturesForm({ data, onUpdate, onNext, onBack }: FeaturesFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Property Features</h2>

      <div className="space-y-4">
        {/* Bedrooms */}
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
            min="0"
            required
          />
        </div>

        {/* Bathrooms */}
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
            min="0"
            required
          />
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

        {/* Property Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Property Description
          </label>
          <textarea
            id="description"
            value={data.description || ''}
            onChange={(e) => onUpdate({ ...data, description: e.target.value })}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Describe the property features, condition, etc."
            required
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
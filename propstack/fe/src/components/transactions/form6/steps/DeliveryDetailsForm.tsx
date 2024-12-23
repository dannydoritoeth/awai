import { useState } from 'react'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'

interface DeliveryDetailsFormProps {
  formData: Form6Data
  onChange: (updates: Partial<Form6Data>) => void
  onNext: () => void
}

export function DeliveryDetailsForm({ formData, onChange, onNext }: DeliveryDetailsFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.deliveryMethod) {
      newErrors.deliveryMethod = 'Please select a delivery method'
    }
    if (!formData.requiredDateTime) {
      newErrors.requiredDateTime = 'Please specify when this is needed'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* Delivery Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Delivery Method
            <div className="mt-1 flex items-center gap-2">
              <select
                value={formData.deliveryMethod}
                onChange={(e) => onChange({ deliveryMethod: e.target.value as 'email' | 'hardcopy' })}
                className="form-input"
              >
                <option value="">Select method...</option>
                <option value="email">Email</option>
                <option value="hardcopy">Hard Copy</option>
              </select>
              <div className="group relative">
                <InfoIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute left-6 top-0 bg-gray-800 text-white p-2 rounded text-sm w-48">
                  Select how you want to receive the Form 6
                </div>
              </div>
            </div>
          </label>
          {errors.deliveryMethod && (
            <p className="mt-1 text-sm text-red-600">{errors.deliveryMethod}</p>
          )}
        </div>

        {/* Required Date/Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Required By
            <div className="mt-1">
              <input
                type="datetime-local"
                value={formData.requiredDateTime}
                onChange={(e) => onChange({ requiredDateTime: e.target.value })}
                className="form-input"
              />
            </div>
          </label>
          {errors.requiredDateTime && (
            <p className="mt-1 text-sm text-red-600">{errors.requiredDateTime}</p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-end">
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
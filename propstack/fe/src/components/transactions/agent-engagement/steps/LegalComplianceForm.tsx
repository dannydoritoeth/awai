import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'

interface LegalComplianceFormProps {
  formData: AgentEngagementData
  onChange: (updates: Partial<AgentEngagementData>) => void
  onNext: () => void
  onBack: () => void
}

type YesNoNa = 'yes' | 'no' | 'na'

export function LegalComplianceForm({ formData, onChange, onNext, onBack }: LegalComplianceFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.sellerWarranties) {
      newErrors.sellerWarranties = 'Please select an option'
    }
    if (!formData.heritageListed) {
      newErrors.heritageListed = 'Please select an option'
    }
    if (!formData.contaminatedLand) {
      newErrors.contaminatedLand = 'Please select an option'
    }
    if (!formData.environmentManagement) {
      newErrors.environmentManagement = 'Please select an option'
    }
    if (!formData.presentLandUse) {
      newErrors.presentLandUse = 'Please select an option'
    }
    if (formData.commission < 0) {
      newErrors.commission = 'Commission cannot be negative'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validate()) {
      onNext()
    }
  }

  const renderYesNoNaSelect = (
    field: keyof Pick<AgentEngagementData, 'sellerWarranties' | 'heritageListed' | 'contaminatedLand' | 'environmentManagement' | 'presentLandUse'>,
    label: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-500">
        {label}
        <div className="mt-1">
          <select
            value={formData[field]}
            onChange={(e) => onChange({ [field]: e.target.value as YesNoNa })}
            className="form-input"
          >
            <option value="">Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="na">N/A</option>
          </select>
        </div>
      </label>
      {errors[field] && (
        <p className="mt-1 text-sm text-red-600">{errors[field]}</p>
      )}
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* Yes/No/NA Questions */}
        <div className="grid grid-cols-2 gap-6">
          {renderYesNoNaSelect('sellerWarranties', 'Seller Warranties')}
          {renderYesNoNaSelect('heritageListed', 'Heritage Listed')}
          {renderYesNoNaSelect('contaminatedLand', 'Contaminated Land')}
          {renderYesNoNaSelect('environmentManagement', 'Environment Management')}
          {renderYesNoNaSelect('presentLandUse', 'Present Land Use')}
        </div>

        {/* Yes/No Questions */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-4">Additional Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.neighbourhoodDisputes}
                onChange={(e) => onChange({ neighbourhoodDisputes: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Neighbourhood Disputes</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.encumbrances}
                onChange={(e) => onChange({ encumbrances: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Encumbrances/Easements</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.gstApplicable}
                onChange={(e) => onChange({ gstApplicable: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">GST Applicable</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.authorisedMarketing}
                onChange={(e) => onChange({ authorisedMarketing: e.target.checked })}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Authorised Marketing</span>
            </label>
          </div>
        </div>

        {/* Commission */}
        <div>
          <label className="block text-sm font-medium text-gray-500">
            Commission Rate (%)
            <div className="mt-1">
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.commission}
                onChange={(e) => onChange({ commission: parseFloat(e.target.value) })}
                className="form-input w-32"
              />
            </div>
          </label>
          {errors.commission && (
            <p className="mt-1 text-sm text-red-600">{errors.commission}</p>
          )}
        </div>

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
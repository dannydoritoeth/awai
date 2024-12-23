import { useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { InfoIcon } from 'lucide-react'
import { Form6Data } from '../types'

interface LegalComplianceFormProps {
  formData: Form6Data
  onChange: (updates: Partial<Form6Data>) => void
  onNext: () => void
  onBack: () => void
}

type YesNoNa = 'yes' | 'no' | 'na'

export function LegalComplianceForm({ 
  formData, 
  onChange, 
  onNext, 
  onBack 
}: LegalComplianceFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
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
    field: keyof Pick<Form6Data, 'sellerWarranties' | 'heritageListed' | 'contaminatedLand' | 'environmentManagement' | 'presentLandUse'>,
    label: string,
    tooltip?: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        <div className="mt-1 flex items-center gap-2">
          <select
            value={formData[field]}
            onChange={(e) => onChange({ [field]: e.target.value as YesNoNa })}
            className="form-input"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="na">N/A</option>
          </select>
          {tooltip && (
            <div className="group relative">
              <InfoIcon className="w-4 h-4 text-gray-400" />
              <div className="hidden group-hover:block absolute left-6 top-0 bg-gray-800 text-white p-2 rounded text-sm w-48">
                {tooltip}
              </div>
            </div>
          )}
        </div>
      </label>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* Legal Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderYesNoNaSelect(
            'sellerWarranties',
            'Seller Warranties',
            'Are there any seller warranties for this property?'
          )}
          {renderYesNoNaSelect(
            'heritageListed',
            'Heritage Listed',
            'Is the property heritage listed?'
          )}
          {renderYesNoNaSelect(
            'contaminatedLand',
            'Contaminated Land',
            'Is this property on the contaminated land register?'
          )}
          {renderYesNoNaSelect(
            'environmentManagement',
            'Environment Management',
            'Is this property subject to environmental management?'
          )}
          {renderYesNoNaSelect(
            'presentLandUse',
            'Present Land Use',
            'Does the present use of the land differ from its zoning?'
          )}
        </div>

        {/* Yes/No Questions */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Additional Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <span className="text-sm text-gray-700">Encumbrances/Easements/Covenants</span>
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
          <label className="block text-sm font-medium text-gray-700">
            Commission Rate (%)
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.commission}
                onChange={(e) => onChange({ commission: parseFloat(e.target.value) })}
                className="form-input w-32"
              />
              <div className="group relative">
                <InfoIcon className="w-4 h-4 text-gray-400" />
                <div className="hidden group-hover:block absolute left-6 top-0 bg-gray-800 text-white p-2 rounded text-sm w-48">
                  Standard commission is 2.75% + GST
                </div>
              </div>
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
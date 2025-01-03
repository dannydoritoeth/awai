import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'

interface ReviewFormProps {
  formData: AgentEngagementData
  onSubmit: () => void
  onBack?: () => void
  loading?: boolean
  readOnly?: boolean
  mode: 'view' | 'create' | 'edit'
}

export function ReviewForm({ formData, onSubmit, onBack, loading, readOnly = false, mode = 'create' }: ReviewFormProps) {
  const renderDetailRow = (label: string, value: any) => {
    if (value === undefined || value === null || value === '') {
      return null
    }

    let displayValue = value
    if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No'
    }

    return (
      <div className="py-2 flex justify-between">
        <dt className="text-sm text-gray-600">{label}</dt>
        <dd className="text-sm text-gray-900 text-right">{displayValue}</dd>
      </div>
    )
  }

  const getSubmitButtonText = () => {
    if (loading) return 'Saving...'
    switch (mode) {
      case 'create':
        return 'Create Engagement'
      case 'edit':
        return 'Save Changes'
      default:
        return 'Submit'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-6">Review Details</h2>

      <div className="space-y-6">
        {/* Delivery Details */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Delivery Details</h3>
          <dl className="divide-y divide-gray-100">
            {renderDetailRow('Delivery Method', formData.deliveryMethod)}
            {renderDetailRow('Required By', formData.requiredDateTime && new Date(formData.requiredDateTime).toLocaleString())}
          </dl>
        </section>

        {/* Seller Information */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Seller Information</h3>
          <dl className="divide-y divide-gray-100">
            {renderDetailRow('Name', formData.sellerName)}
            {renderDetailRow('Address', formData.sellerAddress)}
            {renderDetailRow('Phone', formData.sellerPhone)}
            {renderDetailRow('Email', formData.sellerEmail)}
          </dl>
        </section>

        {/* Property Details */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Property Details</h3>
          <dl className="divide-y divide-gray-100">
            {renderDetailRow('Property Address', formData.propertyAddress)}
            {renderDetailRow('SP Number', formData.spNumber)}
            {renderDetailRow('Survey Plan Number', formData.surveyPlanNumber)}
            {renderDetailRow('Title Reference', formData.titleReference)}
            {renderDetailRow('Sale Method', formData.saleMethod)}
            {formData.saleMethod === 'private' && renderDetailRow('List Price', formData.listPrice)}
            {formData.saleMethod === 'auction' && formData.auctionDetails && (
              <>
                {renderDetailRow('Auction Date', formData.auctionDetails.date)}
                {renderDetailRow('Auction Time', formData.auctionDetails.time)}
                {renderDetailRow('Auction Venue', formData.auctionDetails.venue)}
              </>
            )}
          </dl>
        </section>

        {/* Property Features */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Property Features</h3>
          <dl className="divide-y divide-gray-100">
            {renderDetailRow('Property Type', formData.propertyType)}
            {renderDetailRow('Bedrooms', formData.bedrooms)}
            {renderDetailRow('Bathrooms', formData.bathrooms)}
            {renderDetailRow('Car Spaces', formData.carSpaces)}
            {renderDetailRow('Pool', formData.pool)}
            {renderDetailRow('Body Corp', formData.bodyCorp)}
            {renderDetailRow('Electrical Safety Switch', formData.electricalSafetySwitch)}
            {renderDetailRow('Smoke Alarms', formData.smokeAlarms)}
            {renderDetailRow('Advice to Market Price', formData.adviceToMarketPrice)}
          </dl>
        </section>

        {/* Legal & Compliance */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Legal & Compliance</h3>
          <dl className="divide-y divide-gray-100">
            {renderDetailRow('Seller Warranties', formData.sellerWarranties)}
            {renderDetailRow('Heritage Listed', formData.heritageListed)}
            {renderDetailRow('Contaminated Land', formData.contaminatedLand)}
            {renderDetailRow('Environment Management', formData.environmentManagement)}
            {renderDetailRow('Present Land Use', formData.presentLandUse)}
            {renderDetailRow('Neighbourhood Disputes', formData.neighbourhoodDisputes)}
            {renderDetailRow('Encumbrances', formData.encumbrances)}
            {renderDetailRow('GST Applicable', formData.gstApplicable)}
            {renderDetailRow('Authorised Marketing', formData.authorisedMarketing)}
            {renderDetailRow('Commission', `${formData.commission}%`)}
          </dl>
        </section>
      </div>

      {!readOnly && (
        <div className="flex justify-between mt-8 pt-6 border-t">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <ChevronLeftIcon className="w-5 h-5" />
              Back
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {getSubmitButtonText()}
            {!loading && <ChevronRightIcon className="w-5 h-5" />}
          </button>
        </div>
      )}
    </div>
  )
} 
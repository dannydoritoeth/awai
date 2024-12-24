import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'

interface ReviewFormProps {
  formData: AgentEngagementData
  onSubmit: () => void
  onBack: () => void
  loading?: boolean
}

export function ReviewForm({ formData, onSubmit, onBack, loading }: ReviewFormProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-xl font-semibold mb-6">Review Details</h2>

      <div className="space-y-6">
        {/* Delivery Details */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Delivery Details</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Delivery Method</dt>
            <dd className="text-gray-900">{formData.deliveryMethod}</dd>
            <dt className="text-gray-500">Required By</dt>
            <dd className="text-gray-900">{new Date(formData.requiredDateTime).toLocaleString()}</dd>
          </dl>
        </section>

        {/* Seller Information */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Seller Information</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-gray-900">{formData.sellerName}</dd>
            <dt className="text-gray-500">Address</dt>
            <dd className="text-gray-900">{formData.sellerAddress}</dd>
            <dt className="text-gray-500">Phone</dt>
            <dd className="text-gray-900">{formData.sellerPhone}</dd>
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-900">{formData.sellerEmail}</dd>
          </dl>
        </section>

        {/* Property Details */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Property Details</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Property Address</dt>
            <dd className="text-gray-900">{formData.propertyAddress}</dd>
            <dt className="text-gray-500">SP Number</dt>
            <dd className="text-gray-900">{formData.spNumber}</dd>
            <dt className="text-gray-500">Survey Plan Number</dt>
            <dd className="text-gray-900">{formData.surveyPlanNumber}</dd>
            <dt className="text-gray-500">Title Reference</dt>
            <dd className="text-gray-900">{formData.titleReference}</dd>
            <dt className="text-gray-500">Sale Method</dt>
            <dd className="text-gray-900">{formData.saleMethod}</dd>
            {formData.saleMethod === 'private' ? (
              <>
                <dt className="text-gray-500">List Price</dt>
                <dd className="text-gray-900">{formData.listPrice}</dd>
              </>
            ) : (
              <>
                <dt className="text-gray-500">Auction Details</dt>
                <dd className="text-gray-900">
                  {formData.auctionDetails?.date} at {formData.auctionDetails?.time}<br />
                  Venue: {formData.auctionDetails?.venue}
                </dd>
              </>
            )}
          </dl>
        </section>

        {/* Property Features */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Property Features</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Property Type</dt>
            <dd className="text-gray-900">{formData.propertyType}</dd>
            <dt className="text-gray-500">Bedrooms</dt>
            <dd className="text-gray-900">{formData.bedrooms}</dd>
            <dt className="text-gray-500">Bathrooms</dt>
            <dd className="text-gray-900">{formData.bathrooms}</dd>
            <dt className="text-gray-500">Car Spaces</dt>
            <dd className="text-gray-900">{formData.carSpaces}</dd>
            <dt className="text-gray-500">Features</dt>
            <dd className="text-gray-900">
              {[
                formData.pool && 'Pool',
                formData.bodyCorp && 'Body Corp',
                formData.electricalSafetySwitch && 'Electrical Safety Switch',
                formData.smokeAlarms && 'Smoke Alarms'
              ].filter(Boolean).join(', ') || 'None'}
            </dd>
          </dl>
        </section>

        {/* Legal & Compliance */}
        <section>
          <h3 className="font-medium text-gray-900 mb-4">Legal & Compliance</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Seller Warranties</dt>
            <dd className="text-gray-900">{formData.sellerWarranties}</dd>
            <dt className="text-gray-500">Heritage Listed</dt>
            <dd className="text-gray-900">{formData.heritageListed}</dd>
            <dt className="text-gray-500">Contaminated Land</dt>
            <dd className="text-gray-900">{formData.contaminatedLand}</dd>
            <dt className="text-gray-500">Environment Management</dt>
            <dd className="text-gray-900">{formData.environmentManagement}</dd>
            <dt className="text-gray-500">Present Land Use</dt>
            <dd className="text-gray-900">{formData.presentLandUse}</dd>
            <dt className="text-gray-500">Neighbourhood Disputes</dt>
            <dd className="text-gray-900">{formData.neighbourhoodDisputes}</dd>
            <dt className="text-gray-500">Encumbrances</dt>
            <dd className="text-gray-900">{formData.encumbrances}</dd>
            <dt className="text-gray-500">GST Applicable</dt>
            <dd className="text-gray-900">{formData.gstApplicable}</dd>
            <dt className="text-gray-500">Authorised Marketing</dt>
            <dd className="text-gray-900">{formData.authorisedMarketing}</dd>
            <dt className="text-gray-500">Commission</dt>
            <dd className="text-gray-900">{formData.commission}%</dd>
          </dl>
        </section>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Saving...' : 'Submit'}
          {!loading && <ChevronRightIcon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
} 
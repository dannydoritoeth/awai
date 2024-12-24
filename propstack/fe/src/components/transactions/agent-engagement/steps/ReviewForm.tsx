import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { AgentEngagementData } from '@/components/transactions/agent-engagement/types'

interface ReviewFormProps {
  formData: AgentEngagementData
  onSubmit: () => void
  onBack: () => void
  onEditStep: (step: number) => void
}

export function ReviewForm({ formData, onSubmit, onBack, onEditStep }: ReviewFormProps) {
  const renderSection = (title: string, content: JSX.Element, stepNumber: number) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <button
          onClick={() => onEditStep(stepNumber)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Edit
        </button>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        {content}
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* Property Details Section */}
        {renderSection('Property Details', (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Address of Property</dt>
            <dd className="text-gray-900">{formData.propertyAddress}</dd>
            
            <dt className="text-gray-500">Lot Number</dt>
            <dd className="text-gray-900">{formData.spNumber}</dd>
            
            <dt className="text-gray-500">Survey Plan Number</dt>
            <dd className="text-gray-900">{formData.surveyPlanNumber}</dd>
            
            <dt className="text-gray-500">Title Reference</dt>
            <dd className="text-gray-900">{formData.titleReference}</dd>
            
            <dt className="text-gray-500">Delivery Method</dt>
            <dd className="text-gray-900">{formData.deliveryMethod}</dd>
            
            <dt className="text-gray-500">Required By</dt>
            <dd className="text-gray-900">{new Date(formData.requiredDateTime).toLocaleString()}</dd>
          </dl>
        ), 1)}

        {/* Seller Information Section */}
        {renderSection('Seller Information', (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Full Name/s of Seller</dt>
            <dd className="text-gray-900">{formData.sellerName}</dd>
            
            <dt className="text-gray-500">Address</dt>
            <dd className="text-gray-900">{formData.sellerAddress}</dd>
            
            <dt className="text-gray-500">Phone</dt>
            <dd className="text-gray-900">{formData.sellerPhone}</dd>
            
            <dt className="text-gray-500">Email</dt>
            <dd className="text-gray-900">{formData.sellerEmail}</dd>
            
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
                  {formData.auctionDetails?.date} at {formData.auctionDetails?.time}
                  <br />
                  Venue: {formData.auctionDetails?.venue}
                </dd>
              </>
            )}
          </dl>
        ), 2)}

        {/* Property Features Section */}
        {renderSection('Property Features', (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Property Type</dt>
            <dd className="text-gray-900">{formData.propertyType}</dd>
            
            <dt className="text-gray-500">Bedrooms</dt>
            <dd className="text-gray-900">{formData.bedrooms}</dd>
            
            <dt className="text-gray-500">Bathrooms</dt>
            <dd className="text-gray-900">{formData.bathrooms}</dd>
            
            <dt className="text-gray-500">Car Spaces</dt>
            <dd className="text-gray-900">{formData.carSpaces}</dd>
            
            <dt className="text-gray-500">Additional Features</dt>
            <dd className="text-gray-900">
              {[
                formData.pool && 'Pool',
                formData.bodyCorp && 'Body Corporate',
                formData.electricalSafetySwitch && 'Electrical Safety Switch',
                formData.smokeAlarms && 'Smoke Alarms'
              ].filter(Boolean).join(', ') || 'None'}
            </dd>
          </dl>
        ), 3)}

        {/* Legal & Compliance Section */}
        {renderSection('Legal & Compliance', (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Seller Warranties</dt>
            <dd className="text-gray-900">{formData.sellerWarranties.toUpperCase()}</dd>
            
            <dt className="text-gray-500">Heritage Listed</dt>
            <dd className="text-gray-900">{formData.heritageListed.toUpperCase()}</dd>
            
            <dt className="text-gray-500">Contaminated Land</dt>
            <dd className="text-gray-900">{formData.contaminatedLand.toUpperCase()}</dd>
            
            <dt className="text-gray-500">Environment Management</dt>
            <dd className="text-gray-900">{formData.environmentManagement.toUpperCase()}</dd>
            
            <dt className="text-gray-500">Present Land Use</dt>
            <dd className="text-gray-900">{formData.presentLandUse.toUpperCase()}</dd>
            
            <dt className="text-gray-500">Additional Details</dt>
            <dd className="text-gray-900">
              {[
                formData.neighbourhoodDisputes && 'Neighbourhood Disputes',
                formData.encumbrances && 'Encumbrances/Easements',
                formData.gstApplicable && 'GST Applicable',
                formData.authorisedMarketing && 'Authorised Marketing'
              ].filter(Boolean).join(', ') || 'None'}
            </dd>
            
            <dt className="text-gray-500">Commission Rate</dt>
            <dd className="text-gray-900">{formData.commission}%</dd>
          </dl>
        ), 4)}

        {/* Navigation */}
        <div className="flex justify-between pt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back
          </button>
          <button
            onClick={onSubmit}
            className="px-8 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
} 
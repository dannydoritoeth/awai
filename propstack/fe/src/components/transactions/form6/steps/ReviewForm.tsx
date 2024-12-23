import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { Form6Data } from '../types'

interface ReviewFormProps {
  formData: Form6Data
  onSubmit: () => void
  onBack: () => void
}

export function ReviewForm({ formData, onSubmit, onBack }: ReviewFormProps) {
  const renderSection = (title: string, content: JSX.Element) => (
    <div className="space-y-2">
      <h3 className="font-medium text-gray-900">{title}</h3>
      <div className="bg-gray-50 rounded-lg p-4">
        {content}
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="space-y-6">
        {/* Delivery Details */}
        {renderSection('Delivery Details', (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">Method:</span>
              <p className="text-gray-900">{formData.deliveryMethod}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Required By:</span>
              <p className="text-gray-900">
                {new Date(formData.requiredDateTime).toLocaleString()}
              </p>
            </div>
          </div>
        ))}

        {/* Seller Information */}
        {renderSection('Seller Information', (
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">Name:</span>
              <p className="text-gray-900">{formData.sellerName}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Address:</span>
              <p className="text-gray-900">{formData.sellerAddress}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">Contact:</span>
              <p className="text-gray-900">
                {formData.sellerPhone} | {formData.sellerEmail}
              </p>
            </div>
          </div>
        ))}

        {/* Property Details */}
        {renderSection('Property Details', (
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">Address:</span>
              <p className="text-gray-900">{formData.propertyAddress}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Title Reference:</span>
                <p className="text-gray-900">{formData.titleReference}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">SP Number:</span>
                <p className="text-gray-900">{formData.spNumber}</p>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Sale Method:</span>
              <p className="text-gray-900">
                {formData.saleMethod === 'private' 
                  ? `Private Sale - ${formData.listPrice}`
                  : 'Auction'}
              </p>
            </div>
            {formData.saleMethod === 'auction' && formData.auctionDetails && (
              <div>
                <span className="text-sm text-gray-500">Auction Details:</span>
                <p className="text-gray-900">
                  {formData.auctionDetails.date} at {formData.auctionDetails.time}
                  <br />
                  Venue: {formData.auctionDetails.venue}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Property Features */}
        {renderSection('Property Features', (
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-500">Type:</span>
              <p className="text-gray-900">{formData.propertyType}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-gray-500">Bedrooms:</span>
                <p className="text-gray-900">{formData.bedrooms}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Bathrooms:</span>
                <p className="text-gray-900">{formData.bathrooms}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Car Spaces:</span>
                <p className="text-gray-900">{formData.carSpaces}</p>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Features:</span>
              <ul className="mt-1 text-gray-900">
                {formData.pool && <li>• Pool</li>}
                {formData.bodyCorp && <li>• Body Corporate</li>}
                {formData.electricalSafetySwitch && <li>• Electrical Safety Switch</li>}
                {formData.smokeAlarms && <li>• Smoke Alarms</li>}
              </ul>
            </div>
          </div>
        ))}

        {/* Legal & Compliance */}
        {renderSection('Legal & Compliance', (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Seller Warranties:</span>
                <p className="text-gray-900">{formData.sellerWarranties}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Heritage Listed:</span>
                <p className="text-gray-900">{formData.heritageListed}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Contaminated Land:</span>
                <p className="text-gray-900">{formData.contaminatedLand}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Environment Management:</span>
                <p className="text-gray-900">{formData.environmentManagement}</p>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500">Additional Details:</span>
              <ul className="mt-1 text-gray-900">
                {formData.neighbourhoodDisputes && <li>• Neighbourhood Disputes</li>}
                {formData.encumbrances && <li>• Encumbrances/Easements/Covenants</li>}
                {formData.gstApplicable && <li>• GST Applicable</li>}
                {formData.authorisedMarketing && <li>• Authorised Marketing</li>}
              </ul>
            </div>
            <div>
              <span className="text-sm text-gray-500">Commission Rate:</span>
              <p className="text-gray-900">{formData.commission}%</p>
            </div>
          </div>
        ))}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back
          </button>
          <button
            onClick={onSubmit}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Submit Form 6
          </button>
        </div>
      </div>
    </div>
  )
} 